import { renderIcon } from "./icons.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function getEmptyCredential() {
  return {
    serviceKey: "",
    label: "",
    credentialType: "api_key",
    email: "",
    password: "",
    apiKey: "",
    notes: "",
  };
}

function renderTypeSpecificFields(credentialType, credential) {
  if (credentialType === "email_password") {
    return `
      <label>
        <span class="event-label">Email</span>
        <input class="text-input" name="email" placeholder="name@example.com" value="${escapeHtml(credential.email)}" />
      </label>
      <label>
        <span class="event-label">Password</span>
        <input class="text-input secret-input" type="password" name="password" placeholder="password" value="${escapeHtml(credential.password)}" />
      </label>
    `;
  }

  return `
    <label>
      <span class="event-label">API key</span>
      <input class="text-input secret-input" type="password" name="apiKey" placeholder="api key" value="${escapeHtml(credential.apiKey)}" />
    </label>
  `;
}

function renderEmptyState() {
  return `
    <div class="credentials-empty-state">
      <strong>Select or create a credential</strong>
      <p>Choose one from the list on the left, or create a new credential to start storing API access securely.</p>
    </div>
  `;
}

function renderFormContent(credential) {
  const current = { ...getEmptyCredential(), ...credential };
  const isExistingCredential = Boolean(current.serviceKey);
  return `
    <input type="hidden" name="serviceKeyOriginal" value="${escapeHtml(current.serviceKey)}" />
    <label>
      <span class="event-label">Type</span>
      <select class="text-input select-input" name="credentialType">
        <option value="api_key" ${current.credentialType === "api_key" ? "selected" : ""}>API key</option>
        <option value="email_password" ${current.credentialType === "email_password" ? "selected" : ""}>Email / password</option>
      </select>
    </label>
    <label>
      <span class="event-label">Service key</span>
      <input class="text-input" name="serviceKey" placeholder="fred" required value="${escapeHtml(current.serviceKey)}" />
    </label>
    <label>
      <span class="event-label">Label</span>
      <input class="text-input" name="label" placeholder="FRED API" required value="${escapeHtml(current.label)}" />
    </label>
    <div class="credentials-dynamic-fields" data-dynamic-fields>
      ${renderTypeSpecificFields(current.credentialType, current)}
    </div>
    <label>
      <span class="event-label">Notes</span>
      <textarea class="text-input text-area" name="notes" rows="4" placeholder="optional notes">${escapeHtml(current.notes)}</textarea>
    </label>
    <div class="credentials-form-actions">
      <button class="button" type="submit">Save</button>
      <button class="button button-secondary" type="button" data-reset-form>Reset</button>
      <button class="icon-button icon-button-danger" type="button" data-delete-credential ${isExistingCredential ? "" : "disabled"} aria-label="Delete credential" title="Delete credential">
        ${renderIcon("trash2")}
      </button>
    </div>
  `;
}

function createModalShell() {
  const wrapper = document.createElement("div");
  wrapper.className = "credentials-modal-shell hidden";
  wrapper.innerHTML = `
    <div class="credentials-backdrop" data-close-credentials></div>
    <div class="credentials-modal" role="dialog" aria-modal="true" aria-label="Credentials">
      <div class="credentials-modal-head">
        <div>
          <p class="eyebrow">Settings</p>
          <h2 class="credentials-title">
            <span>Credentials</span>
            <span class="credentials-security-indicator" data-credentials-indicator tabindex="0"></span>
          </h2>
        </div>
        <button class="icon-button" type="button" data-close-credentials aria-label="Close credentials" title="Close">
          ${renderIcon("x")}
        </button>
      </div>
      <div class="credentials-modal-body">
        <section class="credentials-list-panel">
          <div class="section-head">
            <strong>Stored credentials</strong>
            <button class="button" type="button" data-new-credential>New</button>
          </div>
          <div class="credentials-list" data-credentials-list></div>
        </section>
        <section class="credentials-form-panel">
          <form class="credentials-form" data-credentials-form></form>
        </section>
      </div>
    </div>
  `;
  document.body.append(wrapper);
  return wrapper;
}

function ensureToastViewport() {
  let viewport = document.querySelector("[data-toast-viewport]");
  if (viewport) {
    return viewport;
  }

  viewport = document.createElement("div");
  viewport.className = "toast-viewport";
  viewport.setAttribute("data-toast-viewport", "");
  document.body.append(viewport);
  return viewport;
}

function showToast({ tone = "success", title = "", message = "" }) {
  const viewport = ensureToastViewport();
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
  `;

  viewport.append(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  const dismiss = () => {
    toast.classList.remove("visible");
    toast.classList.add("leaving");
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  };

  window.setTimeout(dismiss, 3200);
}

function updateSecurityIndicator(indicator, status) {
  if (!indicator) {
    return;
  }

  const secure = Boolean(status?.secureStorageAvailable);
  indicator.className = `credentials-security-indicator ${secure ? "is-secure" : "is-insecure"}`;
  const message = secure
    ? "Credentials are stored securely on this machine using Electron safeStorage and the local SQLite database."
    : "Secure storage is not available on this machine, so credentials cannot be stored securely.";
  indicator.setAttribute("title", message);
  indicator.setAttribute("aria-label", secure ? "Secure storage available" : "Secure storage unavailable");
}

export function setupCredentialsManager() {
  const shell = createModalShell();
  const listContainer = shell.querySelector("[data-credentials-list]");
  const form = shell.querySelector("[data-credentials-form]");
  const indicator = shell.querySelector("[data-credentials-indicator]");
  let currentCredential = getEmptyCredential();
  let hasShownInsecureToast = false;

  function renderPlaceholder() {
    currentCredential = getEmptyCredential();
    form.innerHTML = renderEmptyState();
  }

  function bindFormInteractions() {
    form.querySelector("[data-reset-form]")?.addEventListener("click", () => {
      currentCredential = getEmptyCredential();
      renderForm(currentCredential);
    });

    form.querySelector("[data-delete-credential]")?.addEventListener("click", async () => {
      const serviceKey = currentCredential.serviceKey?.trim();
      if (!serviceKey) {
        return;
      }

      try {
        const result = await window.financeDesktop.deleteCredential(serviceKey);
        if (!result?.deleted) {
          throw new Error("Credential not found.");
        }
        showToast({
          tone: "success",
          title: "Credential deleted",
          message: `${currentCredential.label || serviceKey} has been removed.`,
        });
        renderPlaceholder();
        await refreshList();
      } catch (error) {
        showToast({
          tone: "error",
          title: "Delete failed",
          message: error.message || "Unable to delete credential.",
        });
      }
    });

    form.elements.credentialType?.addEventListener("change", () => {
      currentCredential = {
        ...currentCredential,
        credentialType: form.elements.credentialType.value,
        email: currentCredential.credentialType === "email_password" ? form.elements.email?.value ?? "" : "",
        password: currentCredential.credentialType === "email_password" ? form.elements.password?.value ?? "" : "",
        apiKey: currentCredential.credentialType === "api_key" ? form.elements.apiKey?.value ?? "" : "",
        serviceKey: form.elements.serviceKey.value,
        label: form.elements.label.value,
        notes: form.elements.notes.value,
      };
      renderForm(currentCredential);
    });
  }

  function renderForm(credential) {
    currentCredential = { ...getEmptyCredential(), ...credential };
    form.innerHTML = renderFormContent(currentCredential);
    bindFormInteractions();
  }

  async function refreshList(selectServiceKey = "") {
    const [items, status] = await Promise.all([
      window.financeDesktop.listCredentials(),
      window.financeDesktop.getCredentialStatus(),
    ]);
    updateSecurityIndicator(indicator, status);
    if (!status.secureStorageAvailable && !hasShownInsecureToast) {
      hasShownInsecureToast = true;
      showToast({
        tone: "warning",
        title: "Secure storage unavailable",
        message: "Credentials cannot be stored securely on this machine.",
      });
    }

    if (!items.length) {
      listContainer.innerHTML = `<div class="status-note"><p>No credentials stored yet.</p></div>`;
      if (!selectServiceKey) {
        renderPlaceholder();
      }
      return;
    }

    listContainer.innerHTML = items
      .map(
        (item) => `
          <button class="credentials-item ${item.serviceKey === selectServiceKey ? "active" : ""}" type="button" data-service-key="${escapeHtml(item.serviceKey)}">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.serviceKey)} · ${escapeHtml(item.credentialType === "email_password" ? "email/password" : "api key")}</span>
          </button>
        `
      )
      .join("");

    listContainer.querySelectorAll("[data-service-key]").forEach((button) => {
      button.addEventListener("click", async () => {
        const serviceKey = button.getAttribute("data-service-key");
        const credential = await window.financeDesktop.getCredential(serviceKey);
        renderForm(credential);
        await refreshList(serviceKey);
      });
    });
  }

  async function openModal() {
    shell.classList.remove("hidden");
    requestAnimationFrame(() => {
      shell.classList.add("visible");
    });
    renderPlaceholder();
    await refreshList();
  }

  function closeModal() {
    shell.classList.remove("visible");
    window.setTimeout(() => {
      if (!shell.classList.contains("visible")) {
        shell.classList.add("hidden");
      }
    }, 220);
  }

  shell.querySelectorAll("[data-close-credentials]").forEach((element) => {
    element.addEventListener("click", closeModal);
  });

  shell.querySelector("[data-new-credential]")?.addEventListener("click", () => {
    renderForm(getEmptyCredential());
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      credentialType: form.elements.credentialType.value,
      serviceKey: form.elements.serviceKey.value.trim(),
      label: form.elements.label.value.trim(),
      email: form.elements.email?.value.trim() ?? "",
      password: form.elements.password?.value ?? "",
      apiKey: form.elements.apiKey?.value ?? "",
      notes: form.elements.notes.value.trim(),
    };

    if (!payload.serviceKey || !payload.label) {
      showToast({
        tone: "warning",
        title: "Missing fields",
        message: "Service key and label are required.",
      });
      return;
    }
    if (payload.credentialType === "email_password" && !payload.email) {
      showToast({
        tone: "warning",
        title: "Missing email",
        message: "Email is required for email/password credentials.",
      });
      return;
    }
    if (payload.credentialType === "api_key" && !payload.apiKey) {
      showToast({
        tone: "warning",
        title: "Missing API key",
        message: "API key is required for api key credentials.",
      });
      return;
    }

    try {
      await window.financeDesktop.saveCredential(payload);
      showToast({
        tone: "success",
        title: "Credential saved",
        message: `${payload.label} has been stored securely.`,
      });
      await refreshList(payload.serviceKey);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Save failed",
        message: error.message || "Unable to save credential.",
      });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shell.classList.contains("hidden")) {
      closeModal();
    }
  });

  window.financeDesktop.onOpenCredentials(() => {
    openModal();
  });

  renderPlaceholder();

  return {
    openModal,
  };
}
