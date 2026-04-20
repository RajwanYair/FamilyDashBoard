/**
 * FamilyDashBoard v8.5.0 — Calendar Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the calendar card.
 * Network-backed: Google Calendar ICS parsing.
 * Delegates all fetch/render logic to the legacy calendar.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initCalendarCard, destroyCalendarCard } from "./calendar";

export class FdbCalendarCard extends FdbCard {
  override connect(): void {
    initCalendarCard();
    diagLog("FDB-029: [fdb-calendar] connected");
  }

  override disconnect(): void {
    destroyCalendarCard();
    diagLog("FDB-029: [fdb-calendar] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-calendar")) {
  customElements.define("fdb-calendar", FdbCalendarCard);
}
