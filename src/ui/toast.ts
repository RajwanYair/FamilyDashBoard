/**
 * FamilyDashBoard v6 — Toast Notifications
 */

import "./toast.css";

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a brief toast message.
 */
export function showToast(message: string, durationMs = 3000): void {
  if (!toastEl?.isConnected)
    toastEl = document.getElementById("toast");
  if (!toastEl) return;

  // Restart the progress bar animation by toggling the class off/on
  toastEl.classList.remove("visible");
  toastEl.style.setProperty("--toast-dur", `${durationMs / 1000}s`);
  // Force reflow so the animation restarts cleanly
  void toastEl.offsetWidth;
  toastEl.textContent = message;
  toastEl.classList.add("visible");

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toastEl?.classList.remove("visible");
  }, durationMs);
}
