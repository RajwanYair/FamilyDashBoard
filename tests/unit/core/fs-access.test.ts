/**
 * tests/unit/core/fs-access.test.ts — *
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
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
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

  it("saveTextFile re-throws non-AbortError from picker", async () => {
    (window as FsaWindow).showSaveFilePicker = vi.fn().mockRejectedValue(new Error("write failed"));
    (window as FsaWindow).showOpenFilePicker = vi.fn();
    await expect(saveTextFile("x", { extensions: [".json"] })).rejects.toThrow("write failed");
  });

  it("saveTextFile returns false when picker resolves with null handle", async () => {
    (window as FsaWindow).showSaveFilePicker = vi.fn().mockResolvedValue(undefined);
    (window as FsaWindow).showOpenFilePicker = vi.fn();
    const result = await saveTextFile("data", { extensions: [".txt"] });
    expect(result).toBe(false);
  });

  it("saveTextFile uses default mimeType when not provided", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    // No showSaveFilePicker → uses fallback (no mimeType provided)
    const ok = await saveTextFile("data", { suggestedName: "out.bin" });
    expect(ok).toBe(true);
  });

  it("saveTextFile fallback uses 'download.txt' when suggestedName is not provided", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    // No suggestedName → defaults to "download.txt"
    await saveTextFile("content", { mimeType: "text/plain" });
    const anchor = clickSpy.mock.contexts[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("download.txt");
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

  it("pickTextFile returns null when picker resolves with empty array", async () => {
    (window as FsaWindow).showOpenFilePicker = vi.fn().mockResolvedValue([]);
    (window as FsaWindow).showSaveFilePicker = vi.fn();
    const result = await pickTextFile({ extensions: [".json"] });
    expect(result).toBeNull();
  });

  it("pickTextFile re-throws non-AbortError from picker", async () => {
    (window as FsaWindow).showOpenFilePicker = vi.fn().mockRejectedValue(new Error("read failed"));
    (window as FsaWindow).showSaveFilePicker = vi.fn();
    await expect(pickTextFile({ extensions: [".json"] })).rejects.toThrow("read failed");
  });

  it("pickTextFile fallback with FileReader onerror rejects the promise", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const fakeError = new Error("read error");
    class MockReaderError {
      onload: null = null;
      onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: null = null;
      error: Error = fakeError;
      readAsText(): void {
        this.onerror?.({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", MockReaderError);
    const p = pickTextFile({ extensions: [".json"] });
    const input = clickSpy.mock.contexts[0] as unknown as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: { 0: new File(["x"], "x.json"), length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    await expect(p).rejects.toBe(fakeError);
    vi.unstubAllGlobals();
  });
});

// ── Uncovered branches: extensions fallback, non-string reader result ─────────

describe("fs-access — branch coverage: extensions fallback and edge cases", () => {
  it("saveTextFile picker path uses empty extensions array when opts.extensions is undefined", async () => {
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
    // No extensions in opts → exercises opts.extensions ?? [] (L64)
    const ok = await saveTextFile("test-content", {
      suggestedName: "test.txt",
      mimeType: "text/plain",
    });
    expect(ok).toBe(true);
    expect(written).toBe("test-content");
  });

  it("pickTextFile picker path uses empty extensions array when opts.extensions is undefined", async () => {
    const file = new File(["data"], "input.txt");
    file.text = (): Promise<string> => Promise.resolve("data");
    const handle = { getFile: vi.fn().mockResolvedValue(file) };
    (window as FsaWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    (window as FsaWindow).showSaveFilePicker = vi.fn();
    // No extensions → exercises opts.extensions ?? [] (L105)
    await expect(pickTextFile({ mimeType: "text/plain" })).resolves.toBe("data");
  });

  it("pickTextFile fallback skips input.accept when no extensions provided", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    class MockReader {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        this.result = "content";
        this.onload?.({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", MockReader);
    // No extensions → exercises the else branch of `if (opts.extensions?.length)` (L121)
    const p = pickTextFile({ mimeType: "text/plain" });
    const input = clickSpy.mock.contexts[0] as unknown as HTMLInputElement;
    expect(input.accept).toBe(""); // no accept attribute set
    Object.defineProperty(input, "files", {
      value: { 0: new File(["content"], "x.txt"), length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    await expect(p).resolves.toBe("content");
    vi.unstubAllGlobals();
  });

  it("pickTextFile fallback resolves null when FileReader.result is not a string", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    class MockReaderNonString {
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((e: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        // Simulate an ArrayBuffer result (edge case — readAsText shouldn't produce this, but defensive code handles it)
        this.result = new ArrayBuffer(8);
        this.onload?.({ target: this as unknown as FileReader } as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal("FileReader", MockReaderNonString);
    const p = pickTextFile({ extensions: [".bin"] });
    const input = clickSpy.mock.contexts[0] as unknown as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: { 0: new File(["x"], "x.bin"), length: 1 },
      configurable: true,
    });
    input.onchange?.(new Event("change"));
    // L130: reader.result is not a string → resolves to null
    await expect(p).resolves.toBeNull();
    vi.unstubAllGlobals();
  });
});
