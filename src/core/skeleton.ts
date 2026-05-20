/**
 * FamilyDashBoard — Skeleton Loading Utility (S61)
 *
 * Provides functions to show/hide shimmer placeholder skeletons
 * inside card bodies while data is loading. Prevents CLS by maintaining
 * the card's visual height during fetch.
 */

const SKELETON_CLASS = "card-skeleton";
const SKELETON_ATTR = "data-skeleton";

/**
 * Inject a skeleton placeholder into a card body element.
 * No-op if a skeleton is already present.
 * @param container - The card body element to inject into
 * @param lines - Number of shimmer lines (default 4)
 */
export function showSkeleton(container: HTMLElement, lines = 4): void {
  if (container.querySelector(`.${SKELETON_CLASS}`)) return;
  const skeleton = document.createElement("div");
  skeleton.className = SKELETON_CLASS;
  skeleton.setAttribute("aria-busy", "true");
  skeleton.setAttribute("aria-label", "טוען נתונים...");
  skeleton.setAttribute(SKELETON_ATTR, "");
  for (let i = 0; i < lines; i++) {
    skeleton.appendChild(document.createElement("span"));
  }
  container.prepend(skeleton);
}

/**
 * Remove the skeleton placeholder from a card body element.
 * No-op if no skeleton is present.
 */
export function hideSkeleton(container: HTMLElement): void {
  const skeleton = container.querySelector<HTMLElement>(`.${SKELETON_CLASS}[${SKELETON_ATTR}]`);
  if (skeleton) skeleton.remove();
}

/**
 * Check whether a skeleton is currently shown in the container.
 */
export function hasActiveSkeleton(container: HTMLElement): boolean {
  return container.querySelector(`.${SKELETON_CLASS}[${SKELETON_ATTR}]`) !== null;
}
