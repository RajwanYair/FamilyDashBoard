/**
 * FamilyDashBoard v8.5.0 — Countdown Card (FdbCard subclass)
 *
 * Stream B2: FdbCard migration for the countdown card.
 * No network dependency — pure client-side timer.
 * Delegates all computation to the legacy countdown.ts helpers.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import {
  tick,
  tick2,
  tick3,
  initCountdownCard,
  destroyCountdownCard,
} from "./countdown";

export class FdbCountdownCard extends FdbCard {
  /** Interval for the 1-second tick, stored for cleanup. */
  private _tickTimer: ReturnType<typeof setInterval> | null = null;

  override connect(): void {
    // Delegate to the legacy init, which caches DOM refs and starts the interval
    initCountdownCard();

    // Store the interval handle so disconnect() can clear it via destroyCountdownCard
    // Also fire a direct tick now so tests/CI see an immediate update
    tick();
    tick2();
    tick3();

    this._tickTimer = setInterval(() => {
      tick();
      tick2();
      tick3();
    }, 1000);

    this.setSyncState("ok");
    diagLog("FDB-031: [fdb-countdown] connected");
  }

  override disconnect(): void {
    destroyCountdownCard();
    if (this._tickTimer !== null) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    diagLog("FDB-031: [fdb-countdown] disconnected");
  }
}

// Register the custom element (idempotent — safe to call multiple times in tests)
if (!customElements.get("fdb-countdown")) {
  customElements.define("fdb-countdown", FdbCountdownCard);
}
