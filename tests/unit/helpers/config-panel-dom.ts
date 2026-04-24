export function setupConfigPanelTestDOM(): void {
  document.body.innerHTML = `
    <div id="config-overlay">
      <div id="config-panel">
        <div class="cfg-tabs">
          <button class="cfg-tab active" data-tab="display">Display</button>
          <button class="cfg-tab" data-tab="calendar">Calendar</button>
          <button class="cfg-tab" data-tab="feeds">Feeds</button>
        </div>
        <div class="cfg-section active" data-tab="display">
          <select id="cfg-interface-language"><option value="he">Hebrew</option><option value="en">English</option></select>
          <select id="screen-mode-select"><option value="tv">TV</option><option value="tablet">Tablet</option></select>
          <select id="theme-select"><option value="black">Black</option><option value="blue">Blue</option></select>
          <textarea id="cfg-bg-url"></textarea>
          <input id="cfg-family-name" type="text" />
          <input id="cfg-members" type="text" />
          <input id="cfg-auto-theme" type="text" />
          <input id="cfg-clock-seconds" type="text" />
          <input id="cfg-dim-start" type="number" />
          <input id="cfg-dim-end" type="number" />
          <input id="cfg-temp-unit" type="text" />
          <input id="cfg-news-fontsize" type="range" />
          <span id="cfg-news-fontsize-val">100%</span>
        </div>
        <div class="cfg-section" data-tab="calendar">
          <textarea id="cfg-birthday"></textarea>
          <input id="cfg-ics-url" type="text" />
          <input id="cfg-ics-url-2" type="text" />
          <input id="cfg-ics-url-3" type="text" />
          <input id="cfg-heb-geonameid" type="text" />
        </div>
        <div class="cfg-section" data-tab="feeds">
          <input id="cfg-ticker-msg" type="text" />
          <input id="cfg-feeds-disabled" type="text" />
          <input id="cfg-stocks-hidden" type="text" />
          <input id="cfg-city-1" type="text" />
          <input id="cfg-city-2" type="text" />
          <input id="cfg-city-3" type="text" />
        </div>
        <div class="cfg-section" data-tab="alerts-tab">
          <select id="alerts-toggle"><option value="on">On</option><option value="off">Off</option></select>
          <input id="cfg-alert-zone" type="text" />
          <input id="cfg-alert-sound" type="text" />
          <input id="cfg-alert-realtime" type="text" />
          <textarea id="cfg-stock-alerts"></textarea>
        </div>
        <div class="cfg-section" data-tab="advanced">
          <input id="cfg-home-lat" type="number" />
          <input id="cfg-home-lon" type="number" />
          <input id="cfg-home-name" type="text" />
          <input id="cfg-custom-proxy" type="url" />
          <select id="cfg-network-mode">
            <option value="auto">auto</option>
            <option value="worker-only">worker-only</option>
            <option value="no-worker">no-worker</option>
            <option value="no-proxy">no-proxy</option>
          </select>
          <input id="cfg-countdown-date" type="date" />
          <input id="cfg-countdown-label" type="text" />
          <input id="cfg-cd-card-title" type="text" />
          <input id="cfg-cd-card-date" type="date" />
          <input id="cfg-cd-card-time" type="time" />
          <input id="cfg-cd-card-done-msg" type="text" />
        </div>
        <select class="cfg-card-size-sel" data-card-id="weather">
          <option value="lg" selected>גדול</option>
        </select>
        <button id="cfg-save-btn">Save</button>
        <button id="cfg-close-btn">Close</button>
      </div>
    </div>
    <div data-card-id="weather" data-card-size="md">Weather Card</div>
    <button id="cfg-gear-btn">⚙️</button>
    <input type="file" id="cfg-import-file" style="display:none" />
  `;
}
