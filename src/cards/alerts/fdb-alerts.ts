/**
 * FamilyDashBoard v13 — Alerts Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the alerts card.
 * Real-time polling: Tzeva Adom / pikud-ha-oref alert feed.
 * Delegates all fetch/render logic to the legacy alerts.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initAlertsCard, destroyAlertsCard } from "./alerts";

export class FdbAlertsCard extends FdbCard {
  override connect(): void {
    initAlertsCard();
    diagLog("FDB-022: [fdb-alerts] connected");
  }

  override disconnect(): void {
    destroyAlertsCard();
    diagLog("FDB-022: [fdb-alerts] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-alerts")) {
  customElements.define("fdb-alerts", FdbAlertsCard);
}
