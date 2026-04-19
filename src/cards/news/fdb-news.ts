import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { destroyNewsCard, initNewsCard, loadNews } from "./news";

export class FdbNewsCard extends FdbCard {
  override connect(): void {
    const { header, body } = this.buildShell("📰", "חדשות", "News");

    if (body.childElementCount === 0) {
      body.classList.add("news-body");
      body.id = "news-body";

      const count = document.createElement("span");
      count.className = "news-count-badge";
      count.id = "news-count";
      header.appendChild(count);

      const bkmPill = document.createElement("span");
      bkmPill.className = "news-bkm-pill";
      bkmPill.id = "news-bkm-pill";
      bkmPill.title = "מוצג: מועדפים בלבד — לחץ לביטול";
      bkmPill.textContent = "🔖 מועדפים";
      header.appendChild(bkmPill);

      const bkmCount = document.createElement("span");
      bkmCount.id = "news-bkm-count";
      bkmCount.title = "כמות פריטים שמורים";
      bkmCount.style.display = "none";
      bkmCount.style.fontSize = "0.62em";
      bkmCount.style.background = "var(--accent)";
      bkmCount.style.color = "#fff";
      bkmCount.style.padding = "1px 5px";
      bkmCount.style.borderRadius = "4px";
      bkmCount.style.fontWeight = "700";
      bkmCount.style.marginRight = "3px";
      bkmCount.style.verticalAlign = "middle";
      header.appendChild(bkmCount);

      const filterBar = document.createElement("div");
      filterBar.className = "news-filter-bar";
      filterBar.id = "news-filter-bar";
      body.appendChild(filterBar);

      const searchWrap = document.createElement("div");
      searchWrap.className = "news-search-wrap";
      searchWrap.id = "news-search-wrap";

      const searchInput = document.createElement("input");
      searchInput.id = "news-search";
      searchInput.type = "text";
      searchInput.placeholder = "🔍 חפש בחדשות...";
      searchInput.autocomplete = "off";
      searchWrap.appendChild(searchInput);

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.id = "news-search-clear";
      clearButton.setAttribute("aria-label", "נקה חיפוש");
      clearButton.title = "נקה חיפוש";
      clearButton.textContent = "✕";
      searchWrap.appendChild(clearButton);

      const searchCount = document.createElement("span");
      searchCount.id = "news-search-count";
      searchWrap.appendChild(searchCount);
      body.appendChild(searchWrap);

      const ticker = document.createElement("div");
      ticker.className = "news-ticker";
      ticker.id = "news-ticker";
      ticker.setAttribute("aria-live", "polite");
      body.appendChild(ticker);

      const scrollWrap = document.createElement("div");
      scrollWrap.className = "news-scroll-wrap";
      const scroll = document.createElement("div");
      scroll.className = "rss-scroll";
      scroll.id = "rss-scroll";
      scrollWrap.appendChild(scroll);
      body.appendChild(scrollWrap);
    }

    initNewsCard();
    diagLog("FDB-067: [fdb-news] connected");
  }

  override disconnect(): void {
    destroyNewsCard();
  }

  override refresh(): Promise<void> {
    return loadNews();
  }
}

if (!customElements.get("fdb-news")) {
  customElements.define("fdb-news", FdbNewsCard);
}
