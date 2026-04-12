import { createMarketExplorerModule } from "../market/shared.js";

export const renderFxModule = createMarketExplorerModule({
  title: "FX monitor",
  categoryLabel: "Marches financiers",
  defaultSymbol: "DX-Y.NYB",
  emptyMessage: "Select a common FX pair or search any Yahoo Finance FX symbol to explore the chart.",
  searchPlaceholder: "DX-Y.NYB, EURUSD=X, JPY=X...",
  searchHelp: "Common symbols: DXY = DX-Y.NYB, EUR/USD = EURUSD=X, USD/JPY = JPY=X, GBP/USD = GBPUSD=X.",
  presets: [
    { symbol: "DX-Y.NYB", label: "DXY", logo: "DX", logoClass: "logo-dxy" },
    { symbol: "EURUSD=X", label: "EUR/USD", logo: "EUR", logoClass: "logo-eur" },
    { symbol: "JPY=X", label: "USD/JPY", logo: "JPY", logoClass: "logo-jpy" },
    { symbol: "GBPUSD=X", label: "GBP/USD", logo: "GBP", logoClass: "logo-gbp" },
    { symbol: "CHF=X", label: "USD/CHF", logo: "CHF", logoClass: "logo-chf" },
  ],
});
