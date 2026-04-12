import { createMarketExplorerModule } from "../market/shared.js";

export const renderCommoditiesModule = createMarketExplorerModule({
  title: "Commodities",
  categoryLabel: "Marches financiers",
  defaultSymbol: "GC=F",
  emptyMessage: "Pick a common commodity future or search any Yahoo Finance symbol to monitor macro-sensitive materials and energy.",
  searchPlaceholder: "GC=F, CL=F, HG=F, SI=F, ZC=F...",
  searchHelp: "Common symbols: WTI = CL=F, Brent = BZ=F, Gold = GC=F, Copper = HG=F, Silver = SI=F, Nat Gas = NG=F, Corn = ZC=F.",
  presets: [
    { symbol: "CL=F", label: "WTI", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f6e2.svg">', logoClass: "logo-icon" },
    { symbol: "BZ=F", label: "Brent", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26fd.svg">', logoClass: "logo-icon" },
    { symbol: "GC=F", label: "Gold", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1fa99.svg">', logoClass: "logo-icon" },
    { symbol: "SI=F", label: "Silver", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1fa99.svg">', logoClass: "logo-icon logo-silver-icon" },
    { symbol: "HG=F", label: "Copper", logoHtml: '<span class="market-commodity-text">Cu</span>', logoClass: "logo-copper" },
    { symbol: "PL=F", label: "Platinum", logoHtml: '<span class="market-commodity-text">Pt</span>', logoClass: "logo-silver" },
    { symbol: "PA=F", label: "Palladium", logoHtml: '<span class="market-commodity-text">Pd</span>', logoClass: "logo-silver" },
    { symbol: "NG=F", label: "Nat Gas", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg">', logoClass: "logo-icon" },
    { symbol: "HO=F", label: "Heating Oil", logoHtml: '<img alt="" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f6e2.svg">', logoClass: "logo-icon" },
    { symbol: "ZC=F", label: "Corn", logoHtml: '<span class="market-commodity-text">C</span>', logoClass: "logo-gold" },
    { symbol: "ZW=F", label: "Wheat", logoHtml: '<span class="market-commodity-text">W</span>', logoClass: "logo-gold" },
    { symbol: "ZS=F", label: "Soybeans", logoHtml: '<span class="market-commodity-text">S</span>', logoClass: "logo-gas" },
    { symbol: "KC=F", label: "Coffee", logoHtml: '<span class="market-commodity-text">Cf</span>', logoClass: "logo-brent" },
    { symbol: "CC=F", label: "Cocoa", logoHtml: '<span class="market-commodity-text">Co</span>', logoClass: "logo-copper" },
  ],
});
