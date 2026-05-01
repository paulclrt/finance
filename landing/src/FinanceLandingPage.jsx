import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CandlestickChart,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Filter,
  LineChart,
  Lock,
  Play,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const chartData = [
  { name: "Mon", value: 42 },
  { name: "Tue", value: 51 },
  { name: "Wed", value: 48 },
  { name: "Thu", value: 68 },
  { name: "Fri", value: 74 },
  { name: "Sat", value: 81 },
  { name: "Sun", value: 96 },
];

const metrics = [
  { label: "Data pipelines", value: "18 active" },
  { label: "Latency", value: "<12 ms" },
  { label: "Assets indexed", value: "10k+" },
  { label: "Modules", value: "12 core" },
];

const features = [
  {
    icon: Sparkles,
    title: "Workspace-first interface",
    text: "A modular research desktop built around panels, layouts, and high-density information flow with zero friction.",
  },
  {
    icon: Brain,
    title: "Research automation layer",
    text: "Python-driven ingestion and structuring of market data into signals, macro context, and structured theses.",
  },
  {
    icon: CandlestickChart,
    title: "Multi-asset research system",
    text: "Equities, macro, FX, commodities, crypto and rates unified in a single local-first workspace.",
  },
  {
    icon: Lock,
    title: "Local-first security model",
    text: "All sensitive operations handled locally with encrypted storage and safe credential management.",
  },
  {
    icon: Filter,
    title: "Advanced filtering engine",
    text: "Screen assets and macro series by regime, volatility, catalysts, correlations, and custom research rules.",
  },
  {
    icon: Zap,
    title: "Keyboard-driven speed",
    text: "Designed for fast exploration, navigation, and analysis without UI overhead or cognitive friction.",
  },
];

const cards = [
  {
    title: "Live data layer",
    subtitle: "Python ingestion · cache system · streaming updates",
    accent: "from-cyan-400/25 to-blue-500/10",
  },
  {
    title: "Research workspace",
    subtitle: "Layouts · modules · persistent state",
    accent: "from-violet-400/25 to-fuchsia-500/10",
  },
  {
    title: "Market map system",
    subtitle: "Sector graph · clustering · performance view",
    accent: "from-emerald-400/25 to-teal-500/10",
  },
];

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/70 backdrop-blur-xl">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.7)]" />
      {children}
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.16),transparent_30%)]" />
      <motion.div
        animate={{ x: [0, 80, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[-10%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -60, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[-8%] top-[20%] h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
    </div>
  );
}

function TickerTape() {
  const items = [
    "AAPL +1.8%",
    "TSLA +3.2%",
    "NVDA +2.4%",
    "EUR/USD 1.086",
    "BTC $68.4K",
    "10Y 4.31%",
    "VIX 14.2",
    "S&P 500 +0.9%",
  ];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/5 py-3 backdrop-blur-xl">
      <motion.div
        className="flex min-w-max items-center gap-8 text-sm text-white/70"
        animate={{ x: [0, -1200] }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function DemoScreen() {
  return (
    <Card className="overflow-hidden border-white/10 bg-black/40 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400/90" />
            <span className="h-3 w-3 rounded-full bg-amber-400/90" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Workspace / Beta</div>
          <div className="text-xs text-white/40">⌘K · Search · Modules · Layouts</div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.95fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/45">Dashboard</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Research signal overview</h3>
              </div>
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                Live
              </div>
            </div>

            <div className="h-64 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.18)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(8,11,18,0.95)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      color: "white",
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#fillChart)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-0">
            <div className="border-b border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Module scans</p>
              <div className="mt-4 space-y-3">
                {[
                  ["Macro regime shift", "active"],
                  ["Inflation trend model", "stable"],
                  ["Market map clustering", "updated"],
                ].map(([a, b]) => (
                  <div key={a} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-white">{a}</div>
                      <div className="text-xs text-white/40">Processed via local cache</div>
                    </div>
                    <div className="text-sm text-cyan-300">{b}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              {metrics.map((m) => (
                <div key={m.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35">{m.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MediaCard({ title, subtitle, accent }) {
  return (
    <Card className="group overflow-hidden border-white/10 bg-white/[0.03] transition-transform duration-300 hover:-translate-y-1 hover:bg-white/[0.045]">
      <CardContent className="p-0">
        <div className={`relative aspect-[16/10] bg-gradient-to-br ${accent} p-5`}>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_30%,transparent_70%,rgba(255,255,255,0.08))] opacity-40" />
          <div className="relative flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#081019]/70 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.25em] text-white/55">Preview</div>
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">04:12</div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-white/90">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <Play className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-white/45">{subtitle}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2.5 w-full rounded-full bg-white/10" />
                <div className="h-2.5 w-5/6 rounded-full bg-white/10" />
                <div className="h-2.5 w-3/5 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinanceLandingPage() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <motion.div
        style={{ scaleX }}
        className="fixed left-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500"
      />

      <main className="relative overflow-hidden">
        <AnimatedBackground />

        <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-6 lg:px-8 lg:pb-28">
          <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <LineChart className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Atlas</div>
                <div className="text-xs text-white/45">Local-first research workstation</div>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" className="text-white/70 hover:bg-white/5 hover:text-white">Product</Button>
              <Button variant="ghost" className="text-white/70 hover:bg-white/5 hover:text-white">Modules</Button>
              <Button variant="ghost" className="text-white/70 hover:bg-white/5 hover:text-white">Architecture</Button>
              <Button className="rounded-full bg-white text-black hover:bg-white/90">
                Request access <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="mx-auto mt-16 max-w-4xl text-center">
            <SectionLabel>Local-first research system</SectionLabel>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="mt-7 text-5xl font-semibold tracking-tight text-white md:text-7xl"
            >
              A modular desktop for building and testing financial research systems.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60"
            >
              Electron workspace with Python ingestion, local caching, macro monitoring, and a configurable market map. Designed for structured research, not dashboards.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button className="h-12 rounded-full bg-white px-6 text-black hover:bg-white/90">
                Open workspace <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10">
                <Play className="mr-2 h-4 w-4" />
                System overview
              </Button>
            </motion.div>
          </div>

          <div className="mt-14">
            <TickerTape />
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              viewport={{ once: true, margin: "-120px" }}
            >
              <DemoScreen />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: "easeOut" }}
              viewport={{ once: true, margin: "-120px" }}
              className="grid gap-4"
            >
              {cards.map((card) => (
                <Card key={card.title} className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/55">{card.subtitle}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/35">
                        <span>Status</span>
                        <span>Local-first</span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-white/80">
                        {[
                          ["Cache", "Active"],
                          ["Sync", "Local"],
                          ["State", "Persistent"],
                        ].map(([a, b]) => (
                          <div key={a} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{a}</div>
                            <div className="mt-2 font-medium text-white">{b}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-5">
              <SectionLabel>System design</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Built as a modular research OS, not a monolithic analytics tool.
              </h2>
              <p className="max-w-xl text-base leading-7 text-white/60">
                The architecture separates ingestion, caching, UI modules, and workspace state so each component can evolve independently without breaking workflows.
              </p>

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {[
                  "Python IPC ingestion",
                  "SQLite local caching",
                  "Detachable market map",
                  "Persistent workspace state",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: i * 0.05 }}
                    viewport={{ once: true, margin: "-80px" }}
                  >
                    <Card className="h-full border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]">
                      <CardContent className="p-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/55">{feature.text}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] backdrop-blur-xl">
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <SectionLabel>System access</SectionLabel>
                  <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
                    A full research stack in a single local environment.
                  </h2>
                </div>

                <div className="flex gap-3">
                  <Button className="rounded-full bg-white px-6 text-black hover:bg-white/90">
                    Get access <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10">
                    View architecture
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
