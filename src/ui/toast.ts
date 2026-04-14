/**
 * FamilyDashBoard v6 — Toast Notifications
 */

let toastEl: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a brief toast message.
 */
export function showToast(message: string, durationMs = 3000): void {
  if (!toastEl || !toastEl.isConnected)
    toastEl = document.getElementById("toast");
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add("visible");

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toastEl?.classList.remove("visible");
  }, durationMs);
}
