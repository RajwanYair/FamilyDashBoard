/**
 * FamilyDashBoard v6 — API Response Types
 *
 * TypeScript interfaces for all external API responses.
 */

// ── Weather (Open-Meteo) ──
export interface WeatherResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    apparent_temperature: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
  };
}

// ── Stocks (Yahoo Finance v8 Chart) ──
export interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        currency: string;
        regularMarketVolume: number;
        averageDailyVolume10Day?: number;
        fiftyTwoWeekLow?: number;
        fiftyTwoWeekHigh?: number;
      };
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

// ── Currency (ER-API) ──
export interface CurrencyResponse {
  rates: Record<string, number>;
  base_code: string;
  time_last_update_utc: string;
}

// ── Hebrew Calendar (Hebcal) ──
export interface HebcalResponse {
  title: string;
  items: HebcalItem[];
}

export interface HebcalItem {
  title: string;
  hebrew: string;
  date: string;
  category:
    | "candles"
    | "havdalah"
    | "holiday"
    | "parashat"
    | "omer"
    | "roshchodesh"
    | string;
  subcat?: string;
  memo?: string;
  link?: string;
}

// ── Sefaria Calendar ──
export interface SefariaCalendarResponse {
  calendar_items: SefariaCalendarItem[];
  date: string;
}

export interface SefariaCalendarItem {
  title: { en: string; he: string };
  url: string;
  ref: string;
  category: string;
  order: number;
  description?: { en: string; he: string };
}

// ── Red Alerts (Tzeva Adom) ──
export interface AlertZone {
  cities: string[];
  threat: number;
  time: number; // Unix timestamp (seconds)
}

export interface AlertEvent {
  alerts: AlertZone[];
  id?: string | number;
}

export type AlertsResponse = AlertEvent[];

// ── CoinGecko (BTC fallback) ──
export interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
}

// ── RSS Feed Item (after parsing) ──
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
}

// ── Calendar (ICS parsed event) ──
export interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  icsIndex: number;
  category?: string;
}
