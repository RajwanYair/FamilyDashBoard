import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { trustedHTML } from "../../core/trusted-types";
import { destroyWeatherCard, initWeatherCard, switchWeatherCity } from "./weather";

export class FdbWeatherCard extends FdbCard {
  override connect(): void {
    const { header, body } = this.buildShell("🌤️", "מזג אוויר", "Weather");

    if (body.childElementCount === 0) {
      body.classList.add("weather-body");

      const cityLabel = header.querySelector("[data-card-title]");
      if (cityLabel) {
        cityLabel.id = "wx-city-label";
        cityLabel.textContent = "🌤️ מזג אויר — ירושלים";
      }

      const skyPill = document.createElement("span");
      skyPill.id = "wx-sky-pill";
      skyPill.className = "wx-sky-pill";
      header.appendChild(skyPill);

      body.innerHTML = trustedHTML(`
        <div class="wx-city-tabs" id="wx-city-tabs">
          <button type="button" class="wx-city-tab active" data-city="jerusalem" data-lat="31.7683" data-lon="35.2137" title="לחץ להצגת מזג אוויר בירושלים">ירושלים</button>
          <button type="button" class="wx-city-tab" data-city="telaviv" data-lat="32.0853" data-lon="34.7818" title="לחץ להצגת מזג אוויר בתל אביב">ת"א</button>
          <button type="button" class="wx-city-tab" data-city="haifa" data-lat="32.7940" data-lon="34.9896" title="לחץ להצגת מזג אוויר בחיפה">חיפה</button>
        </div>
        <div class="wx-top-row">
          <div class="wx-current">
            <div class="wx-icon" id="wx-icon">🌤️</div>
            <div class="wx-info">
              <div class="wx-temp-main temp-toggle" id="wx-temp" title="לחץ לחילוף °C/°F">--°C</div>
              <div id="wx-minmax" class="wx-minmax"></div>
              <div class="wx-desc" id="wx-desc">טוען...</div>
            </div>
          </div>
          <div class="wx-details">
            <div class="wx-detail"><div class="wx-detail-label">💧 לחות</div><div class="wx-detail-val" id="wx-hum">--%</div></div>
            <div class="wx-detail"><div class="wx-detail-label">💨 רוח</div><div class="wx-detail-val" id="wx-wind">--</div><span id="wx-wind-heb"></span><span id="wx-gust"></span></div>
            <div class="wx-detail"><div class="wx-detail-label">☀️ UV</div><div class="wx-detail-val" id="wx-uv">--</div></div>
            <div class="wx-detail"><div class="wx-detail-label" id="wx-rise-label">🌅 זריחה</div><div class="wx-detail-val" id="wx-rise">--:--</div></div>
            <div class="wx-detail"><div class="wx-detail-label">🌡️ מרגיש</div><div class="wx-detail-val" id="wx-feels">--°</div></div>
            <div class="wx-detail"><div class="wx-detail-label">🌫️ נ.ר.</div><div class="wx-detail-val" id="wx-dew">--°</div></div>
            <div class="wx-detail"><div class="wx-detail-label">🌧️ גשם</div><div class="wx-detail-val" id="wx-precip">--%</div></div>
            <div class="wx-detail"><div class="wx-detail-label">☁️ ענניות</div><div class="wx-detail-val" id="wx-cloud">--%</div></div>
          </div>
        </div>
        <button type="button" id="wx-chart-toggle" title="החלף תצוגה">🌡️ טמפ׳</button>
        <div id="wx-hourly-strip" class="wx-hourly-strip" role="list" aria-label="תחזית שעתית"></div>
        <svg class="wx-hourly-chart" id="wx-hourly" viewBox="0 0 500 60" preserveAspectRatio="none"></svg>
        <div id="wx-alert-banner"></div>
        <div id="wx-week-summary"></div>
        <div class="wx-forecast" id="wx-forecast" aria-live="polite" aria-label="תחזית שבועית">
          ${Array.from({ length: 7 }, () => '<div class="wx-fday"><div class="wx-fday-icon">-</div><div class="wx-fday-name">--</div><div class="wx-fday-temp">--°</div></div>').join("\n          ")}
        </div>
      `);
    }

    initWeatherCard();
    diagLog("FDB-068: [fdb-weather] connected");
  }

  override disconnect(): void {
    destroyWeatherCard();
  }

  override refresh(): Promise<void> {
    const active = this.querySelector<HTMLButtonElement>(".wx-city-tab.active");
    const lat = parseFloat(active?.dataset["lat"] ?? "31.7683");
    const lon = parseFloat(active?.dataset["lon"] ?? "35.2137");
    return switchWeatherCity(lat, lon);
  }
}

if (!customElements.get("fdb-weather")) {
  customElements.define("fdb-weather", FdbWeatherCard);
}
