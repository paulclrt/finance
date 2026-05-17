import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { ArrowRightLeft, CircleDollarSign, Globe2, PackageSearch, Route, X } from "lucide-react";
import "./TradeMap.css";

const WIDTH = 1200;
const HEIGHT = 680;

const projection = d3
  .geoNaturalEarth1()
  .scale(215)
  .translate([WIDTH / 2, HEIGHT / 2 + 16]);

const geoPath = d3.geoPath(projection);
const valueFormat = d3.format("$.3s");
const numberFormat = d3.format(",.2f");

function formatTradeValue(valueKusd) {
  return valueFormat(valueKusd * 1000).replace("G", "B");
}

function arcGeometry(source, target) {
  const interpolate = d3.geoInterpolate([source.lon, source.lat], [target.lon, target.lat]);
  return {
    type: "LineString",
    coordinates: d3.range(0, 1.01, 0.035).map(interpolate),
  };
}

function TradeMap() {
  const [tradeData, setTradeData] = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState("");
  const [hoveredFlow, setHoveredFlow] = useState(null);
  const [pinnedFlow, setPinnedFlow] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    fetch("/trade-flows.json")
      .then((response) => response.json())
      .then((payload) => {
        setTradeData(payload);
        setSelectedCommodity(payload.commodities[0]?.code ?? "");
      });
  }, []);

  const countries = useMemo(
    () => feature(worldAtlas, worldAtlas.objects.countries).features,
    []
  );

  const selected = useMemo(() => {
    if (!tradeData || !selectedCommodity) {
      return null;
    }
    return tradeData.commodities.find((item) => item.code === selectedCommodity);
  }, [selectedCommodity, tradeData]);

  const flows = useMemo(() => {
    if (!tradeData || !selectedCommodity) {
      return [];
    }

    return (tradeData.flows[selectedCommodity] ?? [])
      .map((flow) => {
        const exporter = tradeData.countries[flow.exporter];
        const importer = tradeData.countries[flow.importer];
        if (!exporter || !importer) {
          return null;
        }
        return {
          ...flow,
          id: `${selectedCommodity}-${flow.exporter}-${flow.importer}`,
          exporter,
          importer,
          path: geoPath(arcGeometry(exporter, importer)),
        };
      })
      .filter(Boolean);
  }, [selectedCommodity, tradeData]);

  const activeCountries = useMemo(() => {
    const codes = new Set();
    flows.forEach((flow) => {
      codes.add(String(flow.exporter.code));
      codes.add(String(flow.importer.code));
    });
    return codes;
  }, [flows]);

  const maxValue = useMemo(
    () => d3.max(flows, (flow) => flow.value_kusd) ?? 1,
    [flows]
  );

  const widthScale = useMemo(
    () => d3.scaleSqrt().domain([0, maxValue]).range([0.45, 8]),
    [maxValue]
  );

  const topExporters = useMemo(() => {
    const totals = d3.rollups(
      flows,
      (items) => d3.sum(items, (item) => item.value_kusd),
      (item) => item.exporter.iso3
    );
    return totals
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([iso3, value]) => ({
        iso3,
        value,
        name: flows.find((flow) => flow.exporter.iso3 === iso3)?.exporter.name ?? iso3,
      }));
  }, [flows]);

  const selectedFlow = pinnedFlow ?? hoveredFlow;
  const totalVisible = d3.sum(flows, (flow) => flow.value_kusd);

  if (!tradeData) {
    return (
      <main className="trade-app trade-loading">
        <Globe2 size={34} />
        <span>Loading trade routes</span>
      </main>
    );
  }

  return (
    <main className="trade-app">
      <section className="trade-shell">
        <header className="trade-header">
          <div>
            <div className="eyebrow"><Globe2 size={16} /> BACI 2022 world trade</div>
            <h1>Global Commodity Flow Map</h1>
            <p>
              Great-circle export routes by HS commodity, built from the local BACI dataset.
            </p>
          </div>

          <div className="trade-controls" aria-label="Commodity selector">
            <label htmlFor="commodity">Commodity</label>
            <select
              id="commodity"
              value={selectedCommodity}
              onChange={(event) => {
                setSelectedCommodity(event.target.value);
                setPinnedFlow(null);
                setHoveredFlow(null);
              }}
            >
              {tradeData.commodities.map((commodity) => (
                <option key={commodity.code} value={commodity.code}>
                  {commodity.code} · {commodity.description}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="map-stage">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="World trade routes map">
            <defs>
              <linearGradient id="routeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#54d6a1" />
                <stop offset="55%" stopColor="#f5c15c" />
                <stop offset="100%" stopColor="#ef6f6c" />
              </linearGradient>
              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={WIDTH} height={HEIGHT} rx="8" className="ocean" />
            <g className="graticule">
              <path d={geoPath(d3.geoGraticule10())} />
            </g>

            <g className="countries">
              {countries.map((country) => {
                const code = String(Number(country.id));
                return (
                  <path
                    key={country.id}
                    d={geoPath(country)}
                    className={activeCountries.has(code) ? "country active" : "country"}
                  />
                );
              })}
            </g>

            <g className="routes">
              {flows.map((flow, index) => {
                const isFocused = selectedFlow?.id === flow.id;
                return (
                  <path
                    key={flow.id}
                    d={flow.path}
                    className={isFocused ? "route focused" : "route"}
                    style={{
                      "--delay": `${Math.min(index * 0.01, 1.8)}s`,
                      strokeWidth: widthScale(flow.value_kusd),
                      opacity: isFocused ? 0.98 : 0.18 + (flow.value_kusd / maxValue) * 0.5,
                    }}
                    onPointerMove={(event) => {
                      setHoveredFlow(flow);
                      setTooltip({
                        x: event.clientX,
                        y: event.clientY,
                        title: `${flow.exporter.iso3} to ${flow.importer.iso3}`,
                        value: formatTradeValue(flow.value_kusd),
                      });
                    }}
                    onPointerLeave={() => {
                      setHoveredFlow(null);
                      setTooltip(null);
                    }}
                    onClick={() => setPinnedFlow(flow)}
                  />
                );
              })}
            </g>

            <g className="ports">
              {flows.slice(0, 120).flatMap((flow) => [
                { key: `${flow.id}-e`, country: flow.exporter },
                { key: `${flow.id}-i`, country: flow.importer },
              ]).map(({ key, country }) => {
                const point = projection([country.lon, country.lat]);
                if (!point) {
                  return null;
                }
                return <circle key={key} cx={point[0]} cy={point[1]} r="2.4" />;
              })}
            </g>
          </svg>

          {tooltip && (
            <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
              <strong>{tooltip.title}</strong>
              <span>{tooltip.value}</span>
            </div>
          )}

          <aside className="detail-panel">
            {selectedFlow ? (
              <>
                <button className="close-detail" onClick={() => setPinnedFlow(null)} aria-label="Close route detail">
                  <X size={16} />
                </button>
                <span className="panel-label">Route detail</span>
                <h2>{selectedFlow.exporter.name} to {selectedFlow.importer.name}</h2>
                <div className="route-countries">
                  <span>{selectedFlow.exporter.iso3}</span>
                  <ArrowRightLeft size={18} />
                  <span>{selectedFlow.importer.iso3}</span>
                </div>
                <dl>
                  <div>
                    <dt>Trade value</dt>
                    <dd>{formatTradeValue(selectedFlow.value_kusd)}</dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd>{selectedFlow.quantity == null ? "n/a" : numberFormat(selectedFlow.quantity)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <span className="panel-label">Commodity</span>
                <h2>{selected?.code} · {selected?.description}</h2>
                <p>Hover a route for a quick read, or click it to pin the trade lane here.</p>
              </>
            )}
          </aside>
        </section>

        <section className="summary-grid">
          <article>
            <Route size={18} />
            <span>Visible routes</span>
            <strong>{flows.length}</strong>
          </article>
          <article>
            <CircleDollarSign size={18} />
            <span>Visible trade value</span>
            <strong>{formatTradeValue(totalVisible)}</strong>
          </article>
          <article>
            <PackageSearch size={18} />
            <span>HS code</span>
            <strong>{selected?.code}</strong>
          </article>
          <article className="exporter-rank">
            <span>Top exporters</span>
            <div>
              {topExporters.map((item) => (
                <p key={item.iso3}>
                  <b>{item.iso3}</b>
                  <span>{item.name}</span>
                  <em>{formatTradeValue(item.value)}</em>
                </p>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

export default TradeMap;
