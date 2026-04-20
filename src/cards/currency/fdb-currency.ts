/**
 * FamilyDashBoard v8.5.0 — Currency Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the currency card.
 * Network-backed: exchange rates + gold/silver from ER-API.
 * Delegates all fetch/render logic to the legacy currency.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initCurrencyCard, destroyCurrencyCard } from "./currency";

export class FdbCurrencyCard extends FdbCard {
  override connect(): void {
    initCurrencyCard();
    diagLog("FDB-033: [fdb-currency] connected");
  }

  override disconnect(): void {
    destroyCurrencyCard();
    diagLog("FDB-033: [fdb-currency] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-currency")) {
  customElements.define("fdb-currency", FdbCurrencyCard);
}
