/**
 * classifyFetchError tests
 */
import { describe, it, expect } from "vitest";
import { classifyFetchError } from "@/core/fetch";

describe("classifyFetchError ", () => {
  it("classifies AbortError as timeout", () => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    expect(classifyFetchError(err)).toBe("timeout");
  });

  it("classifies TypeError 'Failed to fetch' as network", () => {
    expect(classifyFetchError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("classifies TypeError with 'networkerror' as network", () => {
    expect(
      classifyFetchError(new TypeError("NetworkError when attempting to fetch resource.")),
    ).toBe("network");
  });

  it("classifies TypeError with 'cors' as cors", () => {
    expect(classifyFetchError(new TypeError("CORS request did not succeed"))).toBe("cors");
  });

  it("classifies SyntaxError as invalid-json", () => {
    expect(classifyFetchError(new SyntaxError("Unexpected token < in JSON"))).toBe("invalid-json");
  });

  it("classifies Error with timeout keyword as timeout", () => {
    expect(classifyFetchError(new Error("Request timeout after 8000ms"))).toBe("timeout");
  });

  it("classifies Error with 404 as http-error", () => {
    expect(classifyFetchError(new Error("HTTP 404 Not Found"))).toBe("http-error");
  });

  it("classifies Error with 500 as http-error", () => {
    expect(classifyFetchError(new Error("Server returned 500"))).toBe("http-error");
  });

  it("returns unknown for unrecognized Error", () => {
    expect(classifyFetchError(new Error("Something went wrong"))).toBe("unknown");
  });

  it("returns unknown for non-Error values", () => {
    expect(classifyFetchError("string error")).toBe("unknown");
    expect(classifyFetchError(42)).toBe("unknown");
    expect(classifyFetchError(null)).toBe("unknown");
  });
});
