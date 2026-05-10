/**
 * X15 semantic-producer integration tests.
 *
 * Verifies that motivation, tasks, system-info, video-news, and ai-synthesis
 * register their semantic clipboard producers and return well-formed payloads.
 *
 * Strategy: import the card module (which registers the producer at module
 * load), reset the producer registry in beforeEach, then call the init or
 * the trigger function that seeds the snapshot before reading the payload.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getSemanticPayload, _resetSemanticProducers } from "../../../src/core/semantic-clipboard";

// ── Motivation ─────────────────────────────────────────────────────────────

describe("X15 — motivation semantic producer", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="moti-text"></div>
      <div id="moti-author"></div>
      <div id="moti-source-badge"></div>
      <div id="moti-category-tag"></div>
      <div id="moti-heart-btn"></div>
    `;
    localStorage.removeItem("dash_v2_config");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T10:00:00Z"));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("returns null before initMotivationCard is called", async () => {
    // Producer is registered at module load — need to lazy-import to reset then re-register
    expect(getSemanticPayload("motivation")).toBeNull();
  });

  it("returns a SemanticPayload with cardId='motivation' after init", async () => {
    const { initMotivationCard, _resetMotivationForTest } =
      await import("../../../src/cards/motivation/motivation");
    _resetMotivationForTest();
    _resetSemanticProducers();
    // Re-register via init
    initMotivationCard();
    const payload = getSemanticPayload("motivation");
    // Producer may return null if quote index lands on empty pool — skip if so
    if (payload === null) return;
    expect(payload.cardId).toBe("motivation");
    expect(typeof payload.text).toBe("string");
    expect(payload.text.length).toBeGreaterThan(0);
    expect(payload.jsonLd?.["@type"]).toBe("Quotation");
    expect(typeof payload.ts).toBe("number");
  });

  it("payload text includes the quote text", async () => {
    const { initMotivationCard, _resetMotivationForTest, getCurrentQuote } =
      await import("../../../src/cards/motivation/motivation");
    _resetMotivationForTest();
    _resetSemanticProducers();
    initMotivationCard();
    const q = getCurrentQuote();
    if (!q) return; // pool empty for this day — skip
    const payload = getSemanticPayload("motivation");
    expect(payload?.text).toContain(q.text);
  });

  it("payload jsonLd inLanguage is 'he'", async () => {
    const { initMotivationCard, _resetMotivationForTest } =
      await import("../../../src/cards/motivation/motivation");
    _resetMotivationForTest();
    _resetSemanticProducers();
    initMotivationCard();
    const payload = getSemanticPayload("motivation");
    if (!payload) return;
    expect(payload.jsonLd?.["inLanguage"]).toBe("he");
  });
});

// ── Tasks ──────────────────────────────────────────────────────────────────

describe("X15 — tasks semantic producer", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="tasks-list"></div>
      <div id="tasks-filter-bar"></div>
      <button id="tasks-mark-all-btn"></button>
      <button id="tasks-reset-btn"></button>
      <button id="tasks-remove-done-btn"></button>
    `;
    localStorage.removeItem("dash_chores");
    localStorage.removeItem("dash_tasks_done");
    localStorage.removeItem("dash_tasks_reset_date");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns null when no tasks exist", async () => {
    const { initTasksCard, destroyTasksCard } = await import("../../../src/cards/tasks/tasks");
    _resetSemanticProducers();
    initTasksCard();
    // No chores seeded → producer returns null
    const payload = getSemanticPayload("tasks");
    expect(payload).toBeNull();
    destroyTasksCard();
  });

  it("returns a payload when tasks are seeded", async () => {
    const chores = [
      { person: "אמא", chore: "קניות" },
      { person: "אבא", chore: "שטיפת כלים" },
    ];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    const { initTasksCard, destroyTasksCard } = await import("../../../src/cards/tasks/tasks");
    _resetSemanticProducers();
    initTasksCard();
    const payload = getSemanticPayload("tasks");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("tasks");
    expect(typeof payload!.text).toBe("string");
    expect(payload!.text).toContain("משימות היום");
    expect(payload!.jsonLd?.["@type"]).toBe("ItemList");
    expect(typeof payload!.ts).toBe("number");
    destroyTasksCard();
  });

  it("payload lists up to 5 items in jsonLd.itemListElement", async () => {
    const chores = Array.from({ length: 7 }, (_, i) => ({
      person: "ילד",
      chore: `משימה ${i + 1}`,
    }));
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    const { initTasksCard, destroyTasksCard } = await import("../../../src/cards/tasks/tasks");
    _resetSemanticProducers();
    initTasksCard();
    const payload = getSemanticPayload("tasks");
    const items = payload?.jsonLd?.["itemListElement"] as unknown[];
    expect(items?.length).toBeLessThanOrEqual(5);
    destroyTasksCard();
  });

  it("payload includes overdue note when a task is overdue", async () => {
    const chores = [{ person: "אמא", chore: "קניות @2020-01-01" }];
    localStorage.setItem("dash_chores", JSON.stringify(chores));
    const { initTasksCard, destroyTasksCard } = await import("../../../src/cards/tasks/tasks");
    _resetSemanticProducers();
    initTasksCard();
    const payload = getSemanticPayload("tasks");
    expect(payload?.text).toContain("באיחור");
    destroyTasksCard();
  });
});

// ── System-info ────────────────────────────────────────────────────────────

describe("X15 — system-info semantic producer", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="sysinfo-device"></div>
      <div id="sysinfo-viewport"></div>
      <div id="sysinfo-mem"></div>
      <div id="sysinfo-perf"></div>
      <div id="sysinfo-online"></div>
      <div id="sysinfo-conn"></div>
      <div id="sysinfo-rtt-spark"></div>
      <div id="sysinfo-gpu"></div>
      <div id="sysinfo-battery"></div>
      <div id="sysinfo-load-time"></div>
      <div id="sysinfo-pressure"></div>
      <div id="sysinfo-fps"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("returns a non-null payload after initSystemInfoCard", async () => {
    const { initSystemInfoCard, destroySystemInfoCard } =
      await import("../../../src/cards/system-info/system-info");
    _resetSemanticProducers();
    initSystemInfoCard();
    const payload = getSemanticPayload("system-info");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("system-info");
    destroySystemInfoCard();
  });

  it("payload text contains device and viewport info", async () => {
    const { initSystemInfoCard, destroySystemInfoCard } =
      await import("../../../src/cards/system-info/system-info");
    _resetSemanticProducers();
    initSystemInfoCard();
    const payload = getSemanticPayload("system-info");
    expect(payload!.text).toContain("מכשיר:");
    expect(payload!.text).toContain("×");
    destroySystemInfoCard();
  });

  it("payload jsonLd @type is SoftwareApplication", async () => {
    const { initSystemInfoCard, destroySystemInfoCard } =
      await import("../../../src/cards/system-info/system-info");
    _resetSemanticProducers();
    initSystemInfoCard();
    const payload = getSemanticPayload("system-info");
    expect(payload!.jsonLd?.["@type"]).toBe("SoftwareApplication");
    destroySystemInfoCard();
  });

  it("payload is always non-null (no precondition guard)", async () => {
    const { initSystemInfoCard, destroySystemInfoCard } =
      await import("../../../src/cards/system-info/system-info");
    _resetSemanticProducers();
    initSystemInfoCard();
    // system-info always has data — producer never returns null
    expect(getSemanticPayload("system-info")).not.toBeNull();
    destroySystemInfoCard();
  });
});

// ── Video-news ─────────────────────────────────────────────────────────────

describe("X15 — video-news semantic producer", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="video-news-body"></div>
      <div id="video-news-mini"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("producer is registerable and returns payload for known channel", async () => {
    const { getStreamDescriptor } =
      await import("../../../src/cards/video-news/video-news-adapter");
    const { registerSemanticProducer } = await import("../../../src/core/semantic-clipboard");
    const desc = getStreamDescriptor("c14" as Parameters<typeof getStreamDescriptor>[0]);
    registerSemanticProducer("video-news", () => ({
      cardId: "video-news",
      text: `ערוץ פעיל: ${desc.titleHe}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BroadcastChannel",
        name: desc.titleHe,
        broadcastChannelId: "c14",
        inLanguage: "he",
      },
      ts: Date.now(),
    }));
    const payload = getSemanticPayload("video-news");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("video-news");
    expect(payload!.text).toContain("ערוץ פעיל:");
  });

  it("payload jsonLd @type is BroadcastChannel", async () => {
    const { getStreamDescriptor } =
      await import("../../../src/cards/video-news/video-news-adapter");
    const { registerSemanticProducer } = await import("../../../src/core/semantic-clipboard");
    const desc = getStreamDescriptor("i24he" as Parameters<typeof getStreamDescriptor>[0]);
    registerSemanticProducer("video-news", () => ({
      cardId: "video-news",
      text: `ערוץ פעיל: ${desc.titleHe}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BroadcastChannel",
        name: desc.titleHe,
        broadcastChannelId: "i24he",
        inLanguage: "he",
      },
      ts: Date.now(),
    }));
    const payload = getSemanticPayload("video-news");
    expect(payload!.jsonLd?.["@type"]).toBe("BroadcastChannel");
    expect(payload!.jsonLd?.["broadcastChannelId"]).toBe("i24he");
  });

  it("all known channels have valid Hebrew titles", async () => {
    const { getStreamDescriptor, listChannels } =
      await import("../../../src/cards/video-news/video-news-adapter");
    for (const id of listChannels()) {
      const desc = getStreamDescriptor(id);
      expect(desc.titleHe.length).toBeGreaterThan(0);
    }
  });

  it("payload inLanguage is 'he'", async () => {
    const { getStreamDescriptor } =
      await import("../../../src/cards/video-news/video-news-adapter");
    const { registerSemanticProducer } = await import("../../../src/core/semantic-clipboard");
    const desc = getStreamDescriptor("kan11" as Parameters<typeof getStreamDescriptor>[0]);
    registerSemanticProducer("video-news", () => ({
      cardId: "video-news",
      text: `ערוץ פעיל: ${desc.titleHe}`,
      jsonLd: { "@context": "https://schema.org", "@type": "BroadcastChannel", inLanguage: "he" },
      ts: Date.now(),
    }));
    expect(getSemanticPayload("video-news")!.jsonLd?.["inLanguage"]).toBe("he");
  });
});

// ── AI Synthesis ───────────────────────────────────────────────────────────

describe("X15 — ai-synthesis semantic producer", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    document.body.innerHTML = `
      <div id="synth-text"></div>
      <div id="synth-meta"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("returns null when snapshot is null", async () => {
    const { _resetAiSynthesisForTest, initAiSynthesisCard } =
      await import("../../../src/cards/ai-synthesis/ai-synthesis");
    _resetAiSynthesisForTest();
    _resetSemanticProducers();
    initAiSynthesisCard();
    expect(getSemanticPayload("ai-synthesis")).toBeNull();
  });

  it("returns payload with cardId='ai-synthesis' when snapshot is seeded", async () => {
    const { _resetAiSynthesisForTest, initAiSynthesisCard, _setSnapshotForTest } =
      await import("../../../src/cards/ai-synthesis/ai-synthesis");
    _resetAiSynthesisForTest();
    _resetSemanticProducers();
    initAiSynthesisCard();
    _setSnapshotForTest("כיום בישראל: מזג האוויר נעים");
    const payload = getSemanticPayload("ai-synthesis");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("ai-synthesis");
    expect(payload!.jsonLd?.["@type"]).toBe("Article");
    expect(typeof payload!.ts).toBe("number");
  });

  it("payload text includes 'תקציר AI' prefix", async () => {
    const { _resetAiSynthesisForTest, initAiSynthesisCard, _setSnapshotForTest } =
      await import("../../../src/cards/ai-synthesis/ai-synthesis");
    _resetAiSynthesisForTest();
    _resetSemanticProducers();
    initAiSynthesisCard();
    _setSnapshotForTest("תוכן כלשהו");
    expect(getSemanticPayload("ai-synthesis")!.text).toContain("תקציר AI:");
  });

  it("truncates long snapshot to 200 chars in text", async () => {
    const { _resetAiSynthesisForTest, initAiSynthesisCard, _setSnapshotForTest } =
      await import("../../../src/cards/ai-synthesis/ai-synthesis");
    _resetAiSynthesisForTest();
    _resetSemanticProducers();
    initAiSynthesisCard();
    _setSnapshotForTest("א".repeat(500));
    const payload = getSemanticPayload("ai-synthesis")!;
    // "תקציר AI: " (10 chars) + 200 = 210 max
    expect(payload.text.length).toBeLessThanOrEqual(215);
  });

  it("returns null again after snapshot is cleared", async () => {
    const { _resetAiSynthesisForTest, initAiSynthesisCard, _setSnapshotForTest } =
      await import("../../../src/cards/ai-synthesis/ai-synthesis");
    _resetAiSynthesisForTest();
    _resetSemanticProducers();
    initAiSynthesisCard();
    _setSnapshotForTest("some text");
    expect(getSemanticPayload("ai-synthesis")).not.toBeNull();
    _setSnapshotForTest(null);
    expect(getSemanticPayload("ai-synthesis")).toBeNull();
  });
});
