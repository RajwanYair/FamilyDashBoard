/**
 * src/core/fs-access.ts
 *
 * Thin progressive-enhancement wrapper over the File System Access API
 * (https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
 *
 * Strategy:
 *   - When `window.showSaveFilePicker` / `showOpenFilePicker` exist, use them
 *     so the user picks a real folder + filename, and the browser writes
 *     directly to disk without an in-memory Blob URL.
 *   - When unavailable (Firefox, Safari ≤ 17, old Chromium, all browsers in
 *     `file://`), fall back to the legacy anchor-download / `<input type=file>`
 *     pattern. The fallback is invisible to the caller — the same Promise
 *     resolves either way.
 *
 * No runtime dependency. ~70 LOC. Capability detection only — the contract
 * is: `saveTextFile(...)` writes; `pickTextFile(...)` reads. Errors are
 * surfaced (caller decides how to toast / log).
 */

interface FilePickerOptions {
  /** UI-visible suggested filename. */
  suggestedName?: string;
  /** Mime type for the fallback Blob and the picker’s accept filter. */
  mimeType?: string;
  /** Extension list for the picker filter, e.g. [".json"]. */
  extensions?: string[];
  /** Human-readable label for the picker filter, e.g. "JSON files". */
  description?: string;
}

interface FsaWindow extends Window {
  showSaveFilePicker?: (opts?: unknown) => Promise<FsaHandle>;
  showOpenFilePicker?: (opts?: unknown) => Promise<FsaHandle[]>;
}

interface FsaHandle {
  createWritable(): Promise<{
    write(data: string | Blob): Promise<void>;
    close(): Promise<void>;
  }>;
  getFile(): Promise<File>;
}

function isPickerAvailable(): boolean {
  const w = window as FsaWindow;
  return typeof w.showSaveFilePicker === "function" && typeof w.showOpenFilePicker === "function";
}

/**
 * Save `text` to disk. Resolves to `true` on success, `false` if the user
 * cancelled the picker. Throws on actual write errors.
 */
export async function saveTextFile(text: string, opts: FilePickerOptions): Promise<boolean> {
  const mimeType = opts.mimeType ?? "application/octet-stream";
  if (isPickerAvailable()) {
    const w = window as FsaWindow;
    try {
      const handle = await w.showSaveFilePicker?.({
        suggestedName: opts.suggestedName,
        types: [
          {
            description: opts.description ?? "Files",
            accept: { [mimeType]: opts.extensions ?? [] },
          },
        ],
      });
      if (!handle) return false;
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (err) {
      // AbortError = user cancelled → not an error from our perspective.
      if (err instanceof DOMException && err.name === "AbortError") return false;
      throw err;
    }
  }
  // Fallback: classic blob-download anchor.
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.suggestedName ?? "download.txt";
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Prompt the user to pick a single text file. Resolves to its content, or
 * `null` if the user cancelled. Throws on read errors.
 */
export async function pickTextFile(opts: FilePickerOptions): Promise<string | null> {
  const mimeType = opts.mimeType ?? "application/octet-stream";
  if (isPickerAvailable()) {
    const w = window as FsaWindow;
    try {
      const [handle] =
        (await w.showOpenFilePicker?.({
          multiple: false,
          types: [
            {
              description: opts.description ?? "Files",
              accept: { [mimeType]: opts.extensions ?? [] },
            },
          ],
        })) ?? [];
      if (!handle) return null;
      const file = await handle.getFile();
      return await file.text();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
  }
  // Fallback: hidden <input type="file"> click.
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    if (opts.extensions?.length) input.accept = opts.extensions.join(",");
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = (): void => reject(reader.error);
      reader.onload = (): void => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.readAsText(file);
    };
    // If the user cancels, no `change` event fires — there is no reliable
    // "cancelled" signal in the fallback path; the Promise is left pending,
    // matching the behaviour the file-input pattern always had.
    input.click();
  });
}
