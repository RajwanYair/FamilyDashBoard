import { jsonResponse, proxyResponse } from "../utils/response";

export async function handleWeather(url: URL): Promise<Response> {
  const lat = url.searchParams.get("lat") ?? "31.7683";
  const lon = url.searchParams.get("lon") ?? "35.2137";
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (
    isNaN(latNum) ||
    isNaN(lonNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lonNum < -180 ||
    lonNum > 180
  ) {
    return jsonResponse({ error: "Invalid coordinates" }, 400);
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
  const geonameid = url.searchParams.get("geonameid") ?? "281184";
  if (!/^\d+$/.test(geonameid)) {
    return jsonResponse({ error: "Invalid geonameid" }, 400);
  }
  const res = await fetch(
    `https://www.hebcal.com/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  return proxyResponse(res, 21600); // 6 h
}

export async function handleHebcalHolidays(url: URL): Promise<Response> {
  const year = url.searchParams.get("year");
  const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return jsonResponse({ error: "Invalid year" }, 400);
  }
  const res = await fetch(
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${yearNum}&month=x`,
  );
  return proxyResponse(res, 43200); // 12 h
}
