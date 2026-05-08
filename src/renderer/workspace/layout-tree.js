export function createWidgetNode(widgetId) {
  return { type: "widget", widgetId };
}

export function createSplitNode(orientation, children, sizes = []) {
  const safeChildren = children.filter(Boolean);
  const safeSizes =
    sizes.length === safeChildren.length
      ? sizes
      : Array.from({ length: safeChildren.length }, () => 1 / Math.max(safeChildren.length, 1));

  return { type: "split", orientation, children: safeChildren, sizes: safeSizes };
}

export function createTabsNode(children, activeWidgetId = null) {
  const safeChildren = children.filter(Boolean);
  const widgetIds = safeChildren.map((child) => child.widgetId).filter(Boolean);
  return {
    type: "tabs",
    children: safeChildren,
    activeWidgetId: widgetIds.includes(activeWidgetId) ? activeWidgetId : widgetIds[0] ?? null,
  };
}

export function normalizeSplitNode(node) {
  if (!node || node.type !== "split") {
    return node;
  }

  const children = (node.children ?? []).filter(Boolean);
  if (!children.length) {
    return null;
  }
  if (children.length === 1) {
    return children[0];
  }

  const sizes = node.sizes?.length === children.length ? node.sizes : Array.from({ length: children.length }, () => 1);
  const total = sizes.reduce((sum, value) => sum + value, 0) || children.length;
  return {
    type: "split",
    orientation: node.orientation === "column" ? "column" : "row",
    children,
    sizes: sizes.map((value) => value / total),
  };
}

export function normalizeTabsNode(node) {
  if (!node || node.type !== "tabs") {
    return node;
  }

  const children = (node.children ?? []).filter(Boolean);
  if (!children.length) {
    return null;
  }
  if (children.length === 1) {
    return children[0];
  }

  const ids = children.map((child) => child.widgetId);
  return {
    type: "tabs",
    children,
    activeWidgetId: ids.includes(node.activeWidgetId) ? node.activeWidgetId : ids[0],
  };
}

export function buildDefaultLayoutTree(widgetIds) {
  if (!widgetIds.length) {
    return null;
  }
  if (widgetIds.length === 1) {
    return createWidgetNode(widgetIds[0]);
  }
  if (widgetIds.length === 2) {
    return createSplitNode(
      "row",
      widgetIds.map((widgetId) => createWidgetNode(widgetId)),
      [0.7, 0.3],
    );
  }

  let tree = createSplitNode(
    "row",
    [createWidgetNode(widgetIds[0]), createWidgetNode(widgetIds[1])],
    [0.7, 0.3],
  );

  for (const widgetId of widgetIds.slice(2)) {
    tree = createSplitNode("row", [tree, createWidgetNode(widgetId)], [0.76, 0.24]);
  }

  return tree;
}

export function collectWidgetIds(node, output = []) {
  if (!node) {
    return output;
  }

  if (node.type === "widget") {
    output.push(node.widgetId);
    return output;
  }

  for (const child of node.children ?? []) {
    collectWidgetIds(child, output);
  }
  return output;
}

export function subtreeContainsWidget(node, widgetId) {
  if (!node) {
    return false;
  }
  if (node.type === "widget") {
    return node.widgetId === widgetId;
  }
  return (node.children ?? []).some((child) => subtreeContainsWidget(child, widgetId));
}

export function pruneLayoutTree(node, allowedIds) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    return allowedIds.has(node.widgetId) ? node : null;
  }

  const children = (node.children ?? []).map((child) => pruneLayoutTree(child, allowedIds)).filter(Boolean);
  if (!children.length) {
    return null;
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({ ...node, children });
  }

  return normalizeSplitNode({ ...node, children });
}

export function appendMissingWidgetsToTree(tree, widgetIds) {
  const existing = new Set(collectWidgetIds(tree));
  const missing = widgetIds.filter((widgetId) => !existing.has(widgetId));
  if (!missing.length) {
    return tree;
  }
  if (!tree) {
    return buildDefaultLayoutTree(missing);
  }

  let nextTree = tree;
  for (const widgetId of missing) {
    nextTree = createSplitNode("row", [nextTree, createWidgetNode(widgetId)], [0.76, 0.24]);
  }
  return nextTree;
}

export function parseLayoutTree(config, enabledWidgetIds) {
  const raw = String(config?.widgets?.layout || "").trim();
  let parsed = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error("Unable to parse saved widget layout:", error);
    }
  }

  const allowedIds = new Set(enabledWidgetIds);
  const pruned = pruneLayoutTree(parsed, allowedIds);
  return appendMissingWidgetsToTree(pruned, enabledWidgetIds) ?? buildDefaultLayoutTree(enabledWidgetIds);
}

export function parseNodePath(value) {
  return String(value ?? "")
    .split(".")
    .filter((part) => part !== "")
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isInteger(part) && part >= 0);
}

export function getNodeAtPath(node, path) {
  let currentNode = node;
  for (const index of path) {
    if (!currentNode || !Array.isArray(currentNode.children) || !currentNode.children[index]) {
      return null;
    }
    currentNode = currentNode.children[index];
  }
  return currentNode;
}

export function updateNodeAtPath(node, path, updater) {
  if (!path.length) {
    return updater(node);
  }
  if (!node || !Array.isArray(node.children)) {
    return node;
  }

  const [head, ...tail] = path;
  return {
    ...node,
    children: node.children.map((child, index) => (index === head ? updateNodeAtPath(child, tail, updater) : child)),
  };
}

export function removeWidgetFromTree(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    return node.widgetId === widgetId ? null : node;
  }

  const children = (node.children ?? []).map((child) => removeWidgetFromTree(child, widgetId)).filter(Boolean);
  if (!children.length) {
    return null;
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({ ...node, children });
  }

  const nextSizes = (node.sizes ?? []).filter((_, index) => (node.children?.[index] ? children.includes(node.children[index]) : false));
  return normalizeSplitNode({ ...node, children, sizes: nextSizes });
}

export function addWidgetAsTab(node, targetId, draggedNode) {
  if (!node) {
    return null;
  }

  if (node.type === "widget") {
    if (node.widgetId !== targetId) {
      return node;
    }
    return createTabsNode([node, draggedNode], draggedNode.widgetId);
  }

  if (node.type === "tabs") {
    if (!subtreeContainsWidget(node, targetId)) {
      return node;
    }
    const children = [...node.children];
    if (!children.some((child) => child.widgetId === draggedNode.widgetId)) {
      children.push(draggedNode);
    }
    return createTabsNode(children, draggedNode.widgetId);
  }

  let didChange = false;
  const children = (node.children ?? []).map((child) => {
    const nextChild = addWidgetAsTab(child, targetId, draggedNode);
    if (nextChild !== child) {
      didChange = true;
    }
    return nextChild;
  });
  return didChange ? normalizeSplitNode({ ...node, children }) : node;
}

export function insertWidgetAroundTarget(node, targetId, draggedNode, side) {
  if (!node) {
    return draggedNode;
  }

  if (side === "center") {
    return addWidgetAsTab(node, targetId, draggedNode);
  }

  if (node.type === "widget") {
    if (node.widgetId !== targetId) {
      return node;
    }

    const orientation = side === "top" || side === "bottom" ? "column" : "row";
    const newIsFirst = side === "left" || side === "top";
    const children = newIsFirst ? [draggedNode, node] : [node, draggedNode];
    const sizes = newIsFirst ? [0.32, 0.68] : [0.68, 0.32];
    return createSplitNode(orientation, children, sizes);
  }

  if (node.type === "tabs") {
    if (subtreeContainsWidget(node, targetId)) {
      const orientation = side === "top" || side === "bottom" ? "column" : "row";
      const newIsFirst = side === "left" || side === "top";
      const children = newIsFirst ? [draggedNode, node] : [node, draggedNode];
      const sizes = newIsFirst ? [0.32, 0.68] : [0.68, 0.32];
      return createSplitNode(orientation, children, sizes);
    }
    return node;
  }

  let didChange = false;
  const children = (node.children ?? []).map((child) => {
    const nextChild = insertWidgetAroundTarget(child, targetId, draggedNode, side);
    if (nextChild !== child) {
      didChange = true;
    }
    return nextChild;
  });
  return didChange ? normalizeSplitNode({ ...node, children }) : node;
}

export function setActiveTab(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "tabs") {
    if (node.children.some((child) => child.widgetId === widgetId)) {
      return { ...node, activeWidgetId: widgetId };
    }
    return {
      ...node,
      children: node.children.map((child) => setActiveTab(child, widgetId)),
    };
  }

  if (node.type === "split") {
    return {
      ...node,
      children: node.children.map((child) => setActiveTab(child, widgetId)),
    };
  }

  return node;
}

export function undockTab(node, widgetId) {
  if (!node) {
    return null;
  }

  if (node.type === "tabs" && node.children.some((child) => child.widgetId === widgetId)) {
    if (node.children.length <= 1) {
      return node;
    }

    const remainingChildren = node.children.filter((child) => child.widgetId !== widgetId);
    const remainingTabs = normalizeTabsNode({
      ...node,
      children: remainingChildren,
      activeWidgetId: remainingChildren[0]?.widgetId ?? null,
    });

    return createSplitNode("row", [remainingTabs, createWidgetNode(widgetId)], [0.68, 0.32]);
  }

  if (node.type === "split") {
    return normalizeSplitNode({
      ...node,
      children: node.children.map((child) => undockTab(child, widgetId)),
    });
  }

  if (node.type === "tabs") {
    return normalizeTabsNode({
      ...node,
      children: node.children.map((child) => undockTab(child, widgetId)),
    });
  }

  return node;
}
