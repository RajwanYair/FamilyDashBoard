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
          <input id="cfg-dim-warm" type="text" />
          <input id="cfg-clock-seconds" type="text" />
          <input id="cfg-dim-start" type="number" />
          <input id="cfg-dim-end" type="number" />
          <input id="cfg-temp-unit" type="text" />
          <input id="cfg-news-fontsize" type="range" />
          <span id="cfg-news-fontsize-val">100%</span>
          <input id="cfg-dim-level" type="range" value="60" />
          <span id="cfg-dim-level-val">60%</span>
          <input id="cfg-font-scale" type="range" min="70" max="150" value="100" />
          <span id="cfg-font-scale-val">100%</span>
          <input id="cfg-ticker-speed" type="range" value="3" />
          <span id="cfg-ticker-speed-val">3</span>
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
          <input id="cfg-alert-volume" type="range" value="18" />
          <span id="cfg-alert-volume-val">18%</span>
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
          <input id="cfg-cd-card-start-date" type="date" />
          <input id="cfg-cd2-title" type="text" />
          <input id="cfg-cd2-date" type="date" />
          <input id="cfg-cd2-time" type="time" value="18:00" />
          <input id="cfg-cd2-done-msg" type="text" />
          <input id="cfg-cd3-title" type="text" />
          <input id="cfg-cd3-date" type="date" />
          <input id="cfg-cd3-time" type="time" value="18:00" />
          <input id="cfg-cd3-done-msg" type="text" />
          <textarea id="cfg-chores"></textarea>
          <textarea id="cfg-portfolio"></textarea>
          <input id="cfg-tasks-reset-hour" type="number" value="6" />
          <input id="cfg-moti-interval" type="number" value="0" />
          <select id="cfg-anim-level"><option value="normal" selected>normal</option><option value="none">none</option><option value="minimal">minimal</option><option value="full">full</option></select>
        </div>
        <div class="cfg-section" data-tab="cards">
          <div id="cfg-cards-list"></div>
          <select id="cfg-weather-hourly"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-weather-wind"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-weather-sunrise"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-weather-details"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-weather-us-travel"><option value="off" selected>Off</option><option value="on">On</option></select>
          <select id="cfg-news-show-source"><option value="on" selected>On</option><option value="off">Off</option></select>
          <input id="cfg-news-max-items" type="number" value="20" />
          <select id="cfg-stocks-group-sector"><option value="off" selected>Off</option><option value="on">On</option></select>
          <select id="cfg-stocks-show-portfolio"><option value="off" selected>Off</option><option value="on">On</option></select>
          <select id="cfg-tasks-show-done"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-tasks-show-categories"><option value="on" selected>On</option><option value="off">Off</option></select>
          <select id="cfg-sysinfo-show-rtt"><option value="on" selected>On</option><option value="off">Off</option></select>
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
