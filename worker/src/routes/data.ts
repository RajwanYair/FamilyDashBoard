import { proxyResponse } from "../utils/response";
import {
  ValidationError,
  validationErrorResponse,
  requireLat,
  requireLon,
  requireGeoId,
  requireYear,
} from "../utils/validation";

export async function handleWeather(url: URL): Promise<Response> {
  let latNum: number, lonNum: number;
  try {
    latNum = requireLat(url);
    lonNum = requireLon(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,apparent_temperature,uv_index&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=Asia%2FJerusalem&forecast_days=8`;
  const res = await fetch(weatherUrl);
  return proxyResponse(res, 1800); // 30 min
}

export async function handleCurrency(): Promise<Response> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  return proxyResponse(res, 3600); // 1 h
}

export async function handleHebcal(url: URL): Promise<Response> {
  let geonameid: string;
  try {
    geonameid = requireGeoId(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const res = await fetch(
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  return proxyResponse(res, 21600); // 6 h
}

export async function handleHebcalHolidays(url: URL): Promise<Response> {
  let yearNum: number;
  try {
    yearNum = requireYear(url);
  } catch (err) {
    return validationErrorResponse(err as ValidationError);
  }
  const res = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${yearNum}&month=x`,
  );
  return proxyResponse(res, 43200); // 12 h
}
