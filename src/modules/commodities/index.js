import { createMarketExplorerModule } from "../market/shared.js";

export const renderCommoditiesModule = createMarketExplorerModule({
  title: "Commodities",
  categoryLabel: "Marches financiers",
  defaultSymbol: "GC=F",
  emptyMessage: "Pick a common commodity future or search any Yahoo Finance symbol to monitor macro-sensitive materials and energy.",
  searchPlaceholder: "GC=F, CL=F, HG=F, NG=F...",
  searchHelp: "Common symbols: WTI = CL=F, Brent = BZ=F, Gold = GC=F, Copper = HG=F, Silver = SI=F, Nat Gas = NG=F.",
  presets: [
    { symbol: "CL=F", label: "WTI", logo: "WTI", logoClass: "logo-oil" },
    { symbol: "BZ=F", label: "Brent", logo: "BR", logoClass: "logo-brent" },
    { symbol: "GC=F", label: "Gold", logo: "Au", logoClass: "logo-gold" },
    { symbol: "HG=F", label: "Copper", logo: "Cu", logoClass: "logo-copper" },
    { symbol: "SI=F", label: "Silver", logo: "Ag", logoClass: "logo-silver" },
    { symbol: "NG=F", label: "Nat Gas", logo: "NG", logoClass: "logo-gas" },
  ],
});
