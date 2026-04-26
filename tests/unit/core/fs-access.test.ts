/**
 * tests/unit/core/fs-access.test.ts — Sprint 112
 *
 * Verifies the fallback behaviour of the File System Access wrapper in an
 * environment without `window.showSaveFilePicker` / `showOpenFilePicker`
 * (happy-dom). The picker-available branch is exercised in the dedicated
 * picker-mock test below.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { saveTextFile, pickTextFile } from "@/core/fs-access";

interface FsaWindow extends Window {
  showSaveFilePicker?: unknown;
  showOpenFilePicker?: unknown;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as FsaWindow).showSaveFilePicker;
  delete (window as FsaWindow).showOpenFilePicker;
});

describe("fs-access — saveTextFile fallback (no picker)", () => {
  it("falls back to anchor-download when showSaveFilePicker is unavailable", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const written = await saveTextFile("hello", {
      suggestedName: "hello.txt",
      mimeType: "text/plain",
      extensions: [".txt"],
    });
    expect(written).toBe(true);
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

describe("fs-access — pickTextFile fallback (no picker)", () => {
  it("creates an <input> and resolves with file contents on change", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    class MockReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        this.result = "hi";
        this.onload?.({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", MockReader);
    const p = pickTextFile({ extensions: [".json"], mimeType: "application/json" });
    const input = clickSpy.mock.contexts[0] as unknown as HTMLInputElement;
    expect(input).toBeDefined();
    Object.defineProperty(input, "files", {
      value: { 0: new File(["hi"], "x.json"), length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    await expect(p).resolves.toBe("hi");
    vi.unstubAllGlobals();
  });

  it("resolves with null when no file was selected", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const p = pickTextFile({ extensions: [".json"] });
    const input = clickSpy.mock.contexts[0] as unknown as HTMLInputElement;
    Object.defineProperty(input, "files", { value: null, configurable: true });
    input.onchange?.(new Event("change"));
    await expect(p).resolves.toBeNull();
  });
});

describe("fs-access — picker-available path", () => {
  it("saveTextFile uses showSaveFilePicker when available", async () => {
    let written = "";
    const handle = {
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn(async (data: string) => {
          written = data;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };
    (window as FsaWindow).showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    (window as FsaWindow).showOpenFilePicker = vi.fn();
    const ok = await saveTextFile("payload", {
      suggestedName: "x.json",
      mimeType: "application/json",
      extensions: [".json"],
    });
    expect(ok).toBe(true);
    expect(written).toBe("payload");
  });

  it("saveTextFile returns false when the user aborts the picker", async () => {
    (window as FsaWindow).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException("cancel", "AbortError"));
    (window as FsaWindow).showOpenFilePicker = vi.fn();
    await expect(
      saveTextFile("x", { suggestedName: "x.json", extensions: [".json"] }),
    ).resolves.toBe(false);
  });

  it("pickTextFile reads file content via showOpenFilePicker", async () => {
    const file = new File(["{}"], "cfg.json");
    file.text = (): Promise<string> => Promise.resolve("{}");
    const handle = { getFile: vi.fn().mockResolvedValue(file) };
    (window as FsaWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    (window as FsaWindow).showSaveFilePicker = vi.fn();
    await expect(pickTextFile({ extensions: [".json"] })).resolves.toBe("{}");
  });

  it("pickTextFile returns null when the user aborts", async () => {
    (window as FsaWindow).showOpenFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException("cancel", "AbortError"));
    (window as FsaWindow).showSaveFilePicker = vi.fn();
    await expect(pickTextFile({ extensions: [".json"] })).resolves.toBeNull();
  });
});
