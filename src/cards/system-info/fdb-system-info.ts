/**
 * FamilyDashBoard v8.4.0 — System Info Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the system-info card.
 * No network dependency — client-side hardware/browser polling.
 * Delegates all logic to the legacy system-info.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initSystemInfoCard, destroySystemInfoCard } from "./system-info";

export class FdbSystemInfoCard extends FdbCard {
  override connect(): void {
    initSystemInfoCard();
    this.setSyncState("ok");
    diagLog("FDB-053: [fdb-system-info] connected");
  }

  override disconnect(): void {
    destroySystemInfoCard();
    diagLog("FDB-053: [fdb-system-info] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-system-info")) {
  customElements.define("fdb-system-info", FdbSystemInfoCard);
}
