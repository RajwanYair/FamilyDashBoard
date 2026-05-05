/**
 * Tests for Bank of Israel currency adapter — D8/C-BoI (ADR-061, v14.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseBoIRates, fetchBoIRates, isILGeo } from "@/cards/currency/boi-adapter";

// ── Minimal BoI XML fixtures ──────────────────────────────────────────────────

const VALID_BOI_XML = `
<EXCHANGERATES>
  <LAST_UPDATE>2026-05-05</LAST_UPDATE>
  <CURRENCY>
    <NAME>Dollar</NAME>
    <UNIT>1</UNIT>
    <CURRENCYCODE>USD</CURRENCYCODE>
    <COUNTRY>USA</COUNTRY>
    <RATE>3.7200</RATE>
    <CHANGE>0.020</CHANGE>
  </CURRENCY>
  <CURRENCY>
    <NAME>Euro</NAME>
    <UNIT>1</UNIT>
    <CURRENCYCODE>EUR</CURRENCYCODE>
    <COUNTRY>European Union</COUNTRY>
    <RATE>4.1000</RATE>
    <CHANGE>-0.010</CHANGE>
  </CURRENCY>
  <CURRENCY>
    <NAME>Pound Sterling</NAME>
    <UNIT>1</UNIT>
    <CURRENCYCODE>GBP</CURRENCYCODE>
    <COUNTRY>Great Britain</COUNTRY>
    <RATE>4.7500</RATE>
    <CHANGE>0.005</CHANGE>
  </CURRENCY>
</EXCHANGERATES>
`.trim();

const MULTI_UNIT_XML = `
<EXCHANGERATES>
  <CURRENCY>
    <NAME>Japanese Yen</NAME>
    <UNIT>100</UNIT>
    <CURRENCYCODE>JPY</CURRENCYCODE>
    <COUNTRY>Japan</COUNTRY>
    <RATE>2.5100</RATE>
    <CHANGE>0.001</CHANGE>
  </CURRENCY>
  <CURRENCY>
    <NAME>Dollar</NAME>
    <UNIT>1</UNIT>
    <CURRENCYCODE>USD</CURRENCYCODE>
    <COUNTRY>USA</COUNTRY>
    <RATE>3.7200</RATE>
    <CHANGE>0.020</CHANGE>
  </CURRENCY>
</EXCHANGERATES>
`.trim();

vi.mock("@/core/fetch", () => ({
  fetchWithTimeout: vi.fn(),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/constants")>();
  return {
    ...actual,
    FETCH_TIMEOUT_MS: 8_000,
    PROXIES: ["https://api.allorigins.win/get?url="],
    API: { ...actual.API, CURRENCY_BOI: "https://boi.org.il/PublicApi/GetExchangeRates" },
  };
});

import { fetchWithTimeout } from "@/core/fetch";

describe("parseBoIRates", () => {
  it("parses valid XML and returns ILS-base CurrencyRateResponse", () => {
    const result = parseBoIRates(VALID_BOI_XML);
    expect(result.base_code).toBe("ILS");
    expect(result.rates["ILS"]).toBe(1.0);
    expect(typeof result.rates["USD"]).toBe("number");
    expect(result.rates["USD"]).toBeCloseTo(1 / 3.72, 4);
    expect(result.rates["EUR"]).toBeCloseTo(1 / 4.1, 4);
    expect(result.rates["GBP"]).toBeCloseTo(1 / 4.75, 4);
  });

  it("handles UNIT > 1 correctly (JPY at 100 units)", () => {
    const result = parseBoIRates(MULTI_UNIT_XML);
    // 100 JPY = 2.51 ILS → 1 JPY = 0.0251 ILS → 1 ILS = 1/0.0251 ≈ 39.84 JPY
    expect(result.rates["JPY"]).toBeCloseTo(100 / 2.51, 2);
  });

  it("always includes ILS = 1.0 sentinel", () => {
    const result = parseBoIRates(VALID_BOI_XML);
    expect(result.rates["ILS"]).toBe(1.0);
  });

  it("throws on malformed XML", () => {
    expect(() => parseBoIRates("not xml at all <<<")).toThrow();
  });

  it("throws when no valid currency entries found", () => {
    const emptyXml = "<EXCHANGERATES><LAST_UPDATE>2026-05-05</LAST_UPDATE></EXCHANGERATES>";
    expect(() => parseBoIRates(emptyXml)).toThrow("no valid currency entries");
  });

  it("skips entries with missing CURRENCYCODE", () => {
    const xml = `<EXCHANGERATES>
      <CURRENCY><UNIT>1</UNIT><RATE>3.72</RATE></CURRENCY>
      <CURRENCY><UNIT>1</UNIT><CURRENCYCODE>USD</CURRENCYCODE><RATE>3.72</RATE></CURRENCY>
    </EXCHANGERATES>`;
    const result = parseBoIRates(xml);
    expect(result.rates["USD"]).toBeCloseTo(1 / 3.72, 4);
    // The entry without CURRENCYCODE should be skipped (no spurious key)
    expect(Object.keys(result.rates).filter((k) => k !== "ILS" && k !== "USD")).toHaveLength(0);
  });

  it("skips entries with non-finite or zero RATE", () => {
    const xml = `<EXCHANGERATES>
      <CURRENCY><UNIT>1</UNIT><CURRENCYCODE>BAD</CURRENCYCODE><RATE>0</RATE></CURRENCY>
      <CURRENCY><UNIT>1</UNIT><CURRENCYCODE>USD</CURRENCYCODE><RATE>3.72</RATE></CURRENCY>
    </EXCHANGERATES>`;
    const result = parseBoIRates(xml);
    expect(result.rates["BAD"]).toBeUndefined();
  });
});

describe("isILGeo", () => {
  it("returns true for Tel Aviv (32.07, 34.78)", () => {
    expect(isILGeo(32.07, 34.78)).toBe(true);
  });

  it("returns true for Jerusalem (31.77, 35.21)", () => {
    expect(isILGeo(31.77, 35.21)).toBe(true);
  });

  it("returns false for New York (40.71, -74.0)", () => {
    expect(isILGeo(40.71, -74.0)).toBe(false);
  });

  it("returns false for London (51.5, -0.12)", () => {
    expect(isILGeo(51.5, -0.12)).toBe(false);
  });

  it("returns false for Cairo just outside IL bounds (30.05, 31.24)", () => {
    expect(isILGeo(30.05, 31.24)).toBe(false);
  });
});

describe("fetchBoIRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed rates on successful direct fetch", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce({
      ok: true,
      text: async () => VALID_BOI_XML,
    } as Response);

    const result = await fetchBoIRates();
    expect(result.base_code).toBe("ILS");
    expect(typeof result.rates["USD"]).toBe("number");
  });

  it("falls back to allorigins proxy when direct fetch fails", async () => {
    vi.mocked(fetchWithTimeout)
      .mockRejectedValueOnce(new Error("CORS"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contents: VALID_BOI_XML }),
      } as unknown as Response);

    const result = await fetchBoIRates();
    expect(result.base_code).toBe("ILS");
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(fetchWithTimeout).mock.calls[1]?.[0];
    expect(secondCall).toContain("allorigins");
  });

  it("throws when proxy also fails (non-ok status)", async () => {
    vi.mocked(fetchWithTimeout)
      .mockRejectedValueOnce(new Error("CORS"))
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response);

    await expect(fetchBoIRates()).rejects.toThrow("BoI proxy HTTP 503");
  });

  it("throws when proxy returns unexpected contents shape", async () => {
    vi.mocked(fetchWithTimeout)
      .mockRejectedValueOnce(new Error("CORS"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contents: '{"not":"xml"}' }),
      } as unknown as Response);

    await expect(fetchBoIRates()).rejects.toThrow("unexpected response shape");
  });

  it("falls through to proxy when direct fetch returns non-ok status", async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contents: VALID_BOI_XML }),
      } as unknown as Response);

    const result = await fetchBoIRates();
    expect(result.rates["USD"]).toBeCloseTo(1 / 3.72, 4);
  });
});
