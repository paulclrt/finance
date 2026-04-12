import { createMarketExplorerModule } from "../market/shared.js";

export const renderFxModule = createMarketExplorerModule({
  title: "FX monitor",
  categoryLabel: "Marches financiers",
  defaultSymbol: "DX-Y.NYB",
  emptyMessage: "Select a common FX pair or search any Yahoo Finance FX symbol to explore the chart.",
  searchPlaceholder: "DX-Y.NYB, EURUSD=X, JPY=X, CAD=X...",
  searchHelp: "Common symbols: DXY = DX-Y.NYB, EUR/USD = EURUSD=X, USD/JPY = JPY=X, USD/CAD = CAD=X, AUD/USD = AUDUSD=X.",
  presets: [
    { symbol: "DX-Y.NYB", label: "DXY", logoHtml: '<img alt="" src="https://flagcdn.com/us.svg">', logoClass: "logo-flag" },
    { symbol: "EURUSD=X", label: "EUR/USD", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/eu.svg"><img alt="" src="https://flagcdn.com/us.svg"></span>', logoClass: "logo-pair" },
    { symbol: "JPY=X", label: "USD/JPY", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/us.svg"><img alt="" src="https://flagcdn.com/jp.svg"></span>', logoClass: "logo-pair" },
    { symbol: "GBPUSD=X", label: "GBP/USD", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/gb.svg"><img alt="" src="https://flagcdn.com/us.svg"></span>', logoClass: "logo-pair" },
    { symbol: "CHF=X", label: "USD/CHF", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/us.svg"><img alt="" src="https://flagcdn.com/ch.svg"></span>', logoClass: "logo-pair" },
    { symbol: "AUDUSD=X", label: "AUD/USD", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/au.svg"><img alt="" src="https://flagcdn.com/us.svg"></span>', logoClass: "logo-pair" },
    { symbol: "NZDUSD=X", label: "NZD/USD", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/nz.svg"><img alt="" src="https://flagcdn.com/us.svg"></span>', logoClass: "logo-pair" },
    { symbol: "CAD=X", label: "USD/CAD", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/us.svg"><img alt="" src="https://flagcdn.com/ca.svg"></span>', logoClass: "logo-pair" },
    { symbol: "CNY=X", label: "USD/CNY", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/us.svg"><img alt="" src="https://flagcdn.com/cn.svg"></span>', logoClass: "logo-pair" },
    { symbol: "MXN=X", label: "USD/MXN", logoHtml: '<span class="market-flag-pair"><img alt="" src="https://flagcdn.com/us.svg"><img alt="" src="https://flagcdn.com/mx.svg"></span>', logoClass: "logo-pair" },
  ],
});
