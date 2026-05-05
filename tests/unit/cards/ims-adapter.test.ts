/**
 * Tests for IMS (Israel Meteorological Service) weather adapter — D8/W-IMS (ADR-061, v14.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isILGeo,
  haversineKm,
  imsToWmoCode,
  msToKmh,
  findNearestStation,
  imsStationToWeatherResponse,
  fetchIMS,
} from "@/cards/weather/ims-adapter";
import type { IMSStation } from "@/cards/weather/ims-adapter";

vi.mock("@/core/fetch", () => ({
  fetchJSON: vi.fn(),
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
  cGetStale: vi.fn().mockReturnValue(null),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/constants")>();
  return {
    ...actual,
    API: {
      ...actual.API,
      IMS_CURRENT_WEATHER:
        "https://ims.gov.il/sites/default/files/ims_data/map_data/currentWeather.json",
    },
  };
});

import { fetchJSON } from "@/core/fetch";
import { cGet } from "@/core/cache";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TEL_AVIV_STATION: IMSStation = {
  stn_num: 10,
  time_obs: "2026-05-05T12:00:00",
  lat: 32.07,
  lon: 34.78,
  location: "תל אביב - קוסטה",
  TD: 26.5,
  TDmax: 31.0,
  TDmin: 19.0,
  RH: 58,
  WD: 270,
  WS: 4.5,
  WSmax: 8.0,
  Rain: 0,
  Td: 17.2,
};

const JERUSALEM_STATION: IMSStation = {
  stn_num: 20,
  time_obs: "2026-05-05T12:00:00",
  lat: 31.77,
  lon: 35.21,
  location: "ירושלים",
  TD: 22.0,
  TDmax: 27.0,
  TDmin: 15.0,
  RH: 42,
  WD: 180,
  WS: 2.0,
  WSmax: 5.0,
  Rain: 0,
  Td: 8.5,
};

const RAINY_STATION: IMSStation = {
  stn_num: 30,
  time_obs: "2026-05-05T06:00:00",
  lat: 32.82,
  lon: 35.0,
  location: "נהריה",
  TD: 18.0,
  TDmax: 21.0,
  TDmin: 14.0,
  RH: 88,
  WD: 315,
  WS: 6.0,
  WSmax: 11.0,
  Rain: 5.5,
  Td: 15.8,
};

// ── isILGeo ───────────────────────────────────────────────────────────────────

describe("isILGeo", () => {
  it("returns true for Tel Aviv (32.07, 34.78)", () => {
    expect(isILGeo(32.07, 34.78)).toBe(true);
  });

  it("returns true for Eilat (29.56, 34.95)", () => {
    expect(isILGeo(29.56, 34.95)).toBe(true);
  });

  it("returns false for New York (40.71, -74.0)", () => {
    expect(isILGeo(40.71, -74.0)).toBe(false);
  });

  it("returns false for Amman (31.95, 35.93) — just outside IL bounds", () => {
    // Amman lon 35.93 is just at the edge; .TA quote
    expect(isILGeo(31.95, 35.93)).toBe(false);
  });
});

// ── haversineKm ──────────────────────────────────────────────────────────────

describe("haversineKm", () => {
  it("returns ~0 for same point", () => {
    expect(haversineKm(32.07, 34.78, 32.07, 34.78)).toBeCloseTo(0, 1);
  });

  it("Tel Aviv ↔ Jerusalem is ~60 km", () => {
    const d = haversineKm(32.07, 34.78, 31.77, 35.21);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(70);
  });
});

// ── imsToWmoCode ─────────────────────────────────────────────────────────────

describe("imsToWmoCode", () => {
  it("returns 65 (heavy rain) when rain > 10mm", () => {
    expect(imsToWmoCode(15, 90)).toBe(65);
  });

  it("returns 61 (moderate rain) when 2 < rain ≤ 10", () => {
    expect(imsToWmoCode(5, 80)).toBe(61);
  });

  it("returns 51 (drizzle) when 0.1 < rain ≤ 2", () => {
    expect(imsToWmoCode(0.5, 70)).toBe(51);
  });

  it("returns 45 (fog) when no rain and RH > 90", () => {
    expect(imsToWmoCode(0, 95)).toBe(45);
  });

  it("returns 3 (overcast) when no rain and 75 < RH ≤ 90", () => {
    expect(imsToWmoCode(0, 80)).toBe(3);
  });

  it("returns 2 (partly cloudy) when no rain and 55 < RH ≤ 75", () => {
    expect(imsToWmoCode(0, 65)).toBe(2);
  });

  it("returns 1 (mostly clear) for low humidity and no rain", () => {
    expect(imsToWmoCode(0, 40)).toBe(1);
  });
});

// ── msToKmh ──────────────────────────────────────────────────────────────────

describe("msToKmh", () => {
  it("converts 10 m/s to 36 km/h", () => {
    expect(msToKmh(10)).toBe(36);
  });

  it("converts 0 m/s to 0 km/h", () => {
    expect(msToKmh(0)).toBe(0);
  });
});

// ── findNearestStation ────────────────────────────────────────────────────────

describe("findNearestStation", () => {
  const stations = [TEL_AVIV_STATION, JERUSALEM_STATION, RAINY_STATION];

  it("returns Tel Aviv station for a point near Tel Aviv", () => {
    const result = findNearestStation(stations, 32.05, 34.75);
    expect(result?.location).toBe("תל אביב - קוסטה");
  });

  it("returns Jerusalem station for a point near Jerusalem", () => {
    const result = findNearestStation(stations, 31.8, 35.22);
    expect(result?.location).toBe("ירושלים");
  });

  it("returns null for empty array", () => {
    expect(findNearestStation([], 32.0, 34.8)).toBeNull();
  });

  it("skips stations with missing coordinates", () => {
    const badStation: IMSStation = { stn_num: 99, location: "bad" };
    const result = findNearestStation([badStation, TEL_AVIV_STATION], 32.0, 34.75);
    expect(result?.location).toBe("תל אביב - קוסטה");
  });
});

// ── imsStationToWeatherResponse ───────────────────────────────────────────────

describe("imsStationToWeatherResponse", () => {
  it("maps temperature correctly from TD field", () => {
    const r = imsStationToWeatherResponse(TEL_AVIV_STATION);
    expect(r.current.temperature_2m).toBe(26.5);
  });

  it("maps wind speed from m/s to km/h", () => {
    const r = imsStationToWeatherResponse(TEL_AVIV_STATION);
    expect(r.current.wind_speed_10m).toBe(msToKmh(4.5));
  });

  it("includes daily max/min from TDmax/TDmin", () => {
    const r = imsStationToWeatherResponse(TEL_AVIV_STATION);
    expect(r.daily.temperature_2m_max[0]).toBe(31.0);
    expect(r.daily.temperature_2m_min[0]).toBe(19.0);
  });

  it("returns 24 hourly entries", () => {
    const r = imsStationToWeatherResponse(TEL_AVIV_STATION);
    expect(r.hourly.time).toHaveLength(24);
    expect(r.hourly.temperature_2m).toHaveLength(24);
  });

  it("produces rainy WMO code for station with Rain=5.5", () => {
    const r = imsStationToWeatherResponse(RAINY_STATION);
    expect(r.current.weather_code).toBe(61); // moderate rain
  });

  it("falls back to tempC ±3 when TDmax/TDmin are null", () => {
    const s: IMSStation = { ...TEL_AVIV_STATION, TDmax: null, TDmin: null };
    const r = imsStationToWeatherResponse(s);
    expect(r.daily.temperature_2m_max[0]).toBeCloseTo(26.5 + 3, 1);
    expect(r.daily.temperature_2m_min[0]).toBeCloseTo(26.5 - 3, 1);
  });

  it("handles fully missing optional fields gracefully (no NaN/undefined)", () => {
    const sparse: IMSStation = { stn_num: 1 };
    const r = imsStationToWeatherResponse(sparse);
    expect(isFinite(r.current.temperature_2m)).toBe(true);
    expect(isFinite(r.current.wind_speed_10m)).toBe(true);
  });
});

// ── fetchIMS ─────────────────────────────────────────────────────────────────

describe("fetchIMS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cGet).mockReturnValue(null);
  });

  it("throws for non-IL coordinates (New York)", async () => {
    await expect(fetchIMS(40.71, -74.0)).rejects.toThrow("outside IL bounds");
  });

  it("returns cached data when cache hit", async () => {
    const cached = imsStationToWeatherResponse(TEL_AVIV_STATION);
    vi.mocked(cGet).mockReturnValue(cached);

    const result = await fetchIMS(32.07, 34.78);
    expect(result.current.temperature_2m).toBe(26.5);
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it("fetches and returns nearest station data for IL coordinates", async () => {
    vi.mocked(fetchJSON).mockResolvedValueOnce([TEL_AVIV_STATION, JERUSALEM_STATION]);

    const result = await fetchIMS(32.07, 34.78);
    expect(result.current.temperature_2m).toBe(26.5);
  });

  it("throws when API returns empty array", async () => {
    vi.mocked(fetchJSON).mockResolvedValueOnce([]);
    await expect(fetchIMS(32.07, 34.78)).rejects.toThrow("empty or invalid");
  });

  it("throws when API returns non-array", async () => {
    vi.mocked(fetchJSON).mockResolvedValueOnce({ error: "not an array" });
    await expect(fetchIMS(32.07, 34.78)).rejects.toThrow("empty or invalid");
  });

  it("throws when no station has valid coordinates", async () => {
    const badStations: IMSStation[] = [{ stn_num: 1 }, { stn_num: 2 }];
    vi.mocked(fetchJSON).mockResolvedValueOnce(badStations);
    await expect(fetchIMS(32.07, 34.78)).rejects.toThrow("no station with valid coordinates");
  });
});
