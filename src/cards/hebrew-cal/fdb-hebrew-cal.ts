/**
 * FamilyDashBoard v13 — Hebrew Calendar Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the hebrew-cal card.
 * Network-backed: Hebcal API for zmanim, holidays, and parasha.
 * Delegates all fetch/render logic to the legacy hebrew-cal.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initHebrewCalCard, destroyHebrewCalCard } from "./hebrew-cal";

export class FdbHebrewCalCard extends FdbCard {
  override connect(): void {
    initHebrewCalCard();
    diagLog("FDB-038: [fdb-hebrew-cal] connected");
  }

  override disconnect(): void {
    destroyHebrewCalCard();
    diagLog("FDB-038: [fdb-hebrew-cal] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-hebrew-cal")) {
  customElements.define("fdb-hebrew-cal", FdbHebrewCalCard);
}
