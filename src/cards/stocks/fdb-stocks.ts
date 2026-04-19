import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import {
  applyHiddenStocks,
  destroyStocksCard,
  initStocksCard,
  loadAllStocks,
  renderStocksShell,
  updateMarketBadge,
  updateMarketCountdown,
} from "./stocks";

export class FdbStocksCard extends FdbCard {
  override connect(): void {
    const { header, body, footer } = this.buildShell("📈", "מניות", "Stocks");

    if (body.childElementCount === 0) {
      body.classList.add("stocks-body");

      const scroll = document.createElement("div");
      scroll.className = "stocks-scroll";
      scroll.id = "stocks-body";
      scroll.setAttribute("aria-live", "polite");
      scroll.setAttribute("aria-label", "נתוני מניות");
      body.appendChild(scroll);

      const marketBadge = document.createElement("span");
      marketBadge.className = "market-badge";
      marketBadge.id = "market-badge";
      marketBadge.title = "סטטוס בורסה — 🟢 פתוח 🔴 סגור";
      header.appendChild(marketBadge);

      const summary = document.createElement("div");
      summary.id = "stk-summary";
      summary.className = "stk-summary";
      footer.appendChild(summary);

      const totalRow = document.createElement("div");
      totalRow.id = "stk-total-row";
      totalRow.className = "stk-total-row";
      totalRow.style.display = "none";
      totalRow.title = "סה״כ שווי תיק — הגדר מניות בהגדרות → מתקדם";

      const totalLabel = document.createElement("span");
      totalLabel.className = "stk-total-label";
      totalLabel.textContent = "💼 תיק:";
      totalRow.appendChild(totalLabel);

      const totalValue = document.createElement("span");
      totalValue.id = "stk-total-val";
      totalValue.textContent = "--";
      totalRow.appendChild(totalValue);

      const totalPnl = document.createElement("span");
      totalPnl.id = "stk-total-pnl";
      totalRow.appendChild(totalPnl);
      footer.appendChild(totalRow);

      const countdown = document.createElement("div");
      countdown.id = "stk-mkt-countdown";
      footer.appendChild(countdown);
    }

    renderStocksShell();
    applyHiddenStocks();
    updateMarketBadge();
    updateMarketCountdown();
    initStocksCard();
    diagLog("FDB-066: [fdb-stocks] connected");
  }

  override disconnect(): void {
    destroyStocksCard();
  }

  override refresh(): Promise<void> {
    updateMarketBadge();
    updateMarketCountdown();
    return loadAllStocks();
  }
}

if (!customElements.get("fdb-stocks")) {
  customElements.define("fdb-stocks", FdbStocksCard);
}