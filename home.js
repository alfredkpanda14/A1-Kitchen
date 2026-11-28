/* A1 Kitchen: home page extras (specials, event countdown, latest photos,
   customer words, upcoming events and how-to guides) */
const BUCKET_URL = SUPABASE_URL + "/storage/v1/object/public/gallery/";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined && text !== null) {
    node.textContent = text;
  }
  return node;
}

async function callRpc(name, params) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params || {}),
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

function thumbLink(item, className) {
  const link = el("a", className);
  link.href = "gallery.html";
  link.setAttribute(
    "aria-label",
    (item.kind === "video" ? "Watch video: " : "See photo: ") +
      (item.title || item.caption || "A1 Kitchen"),
  );
  const path = item.thumb_path || (item.kind === "photo" ? item.file_path : "");
  if (path) {
    const image = el("img");
    image.src = BUCKET_URL + path;
    image.alt =
      item.kind === "photo"
        ? item.title || item.caption || "A1 Kitchen photo"
        : "";
    image.loading = "lazy";
    image.decoding = "async";
    link.appendChild(image);
  } else {
    link.appendChild(el("span", "gallery-noposter", "Video"));
  }
  if (item.kind === "video") {
    link.appendChild(el("span", "play-badge", "▶"));
  }
  return link;
}

async function loadWork() {
  const result = await callRpc("get_public_gallery", {
    p_section: "work",
    p_limit: 4,
    p_offset: 0,
  });
  const items = (result && result.items) || [];
  if (items.length === 0) {
    return;
  }
  const grid = document.getElementById("home-work-grid");
  items.forEach((item) => grid.appendChild(thumbLink(item, "home-work-link")));
  document.getElementById("home-work").hidden = false;
}

async function loadWords() {
  const result = await callRpc("get_public_gallery", {
    p_section: "testimony",
    p_limit: 3,
    p_offset: 0,
  });
  const items = (result && result.items) || [];
  if (items.length === 0) {
    return;
  }
  const grid = document.getElementById("home-quotes-grid");
  items.forEach((item) => {
    const card = el("div", "home-quote");
    const text = item.caption || item.title;
    if (text) {
      card.appendChild(el("p", "home-quote-text", text));
    }
    if (item.thumb_path || item.kind === "video") {
      card.appendChild(thumbLink(item, "home-quote-thumb"));
    }
    if (item.person_name) {
      card.appendChild(el("p", "home-quote-by", item.person_name));
    }
    grid.appendChild(card);
  });
  document.getElementById("home-words").hidden = false;
}

loadWork().catch((error) => console.error("Home photos error:", error));
loadWords().catch((error) => console.error("Home words error:", error));

/* ---------- Countdown to the next event (Freetown time = GMT) ---------- */

function freetownToday() {
  return new Date().toISOString().slice(0, 10);
}

/* Reads times such as "10:00 AM", "2pm", "4.30 p.m." or "14:00" */
function startMinutes(timeText) {
  const text = String(timeText || "").trim();
  let match = text.match(/(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*([ap])\.?\s*m\b/i);
  if (match) {
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours < 1 || hours > 12 || minutes > 59) {
      return null;
    }
    const pm = match[3].toLowerCase() === "p";
    if (hours === 12) {
      hours = pm ? 12 : 0;
    } else if (pm) {
      hours += 12;
    }
    return hours * 60 + minutes;
  }
  match = text.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (match && Number(match[1]) < 24 && Number(match[2]) < 60) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return null;
}

const countdowns = [];
let countdownTimer = null;

function countdownBox(event) {
  const parts = String(event.event_date || "")
    .split("-")
    .map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const minutes = startMinutes(event.start_time);
  const dayStart = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const target = dayStart + (minutes === null ? 0 : minutes * 60000);
  const dayEnd = dayStart + 24 * 3600000;
  if (Date.now() >= dayEnd) {
    return null;
  }

  const box = el("div", "home-countdown");
  box.setAttribute("role", "timer");
  const label = el(
    "p",
    "home-countdown-label",
    minutes === null ? "The big day is in" : "Starts in",
  );
  const row = el("div", "home-countdown-row");
  const cells = {};
  [
    ["days", "Days"],
    ["hours", "Hours"],
    ["mins", "Mins"],
    ["secs", "Secs"],
  ].forEach(([key, name]) => {
    const cell = el("div", "home-countdown-cell");
    const number = el("strong", null, "0");
    cell.append(number, el("span", null, name));
    row.appendChild(cell);
    cells[key] = number;
  });
  box.append(label, row);
  countdowns.push({
    box,
    label,
    row,
    cells,
    target,
    dayEnd,
    title: event.title,
  });
  tickCountdowns();
  if (!countdownTimer) {
    countdownTimer = window.setInterval(tickCountdowns, 1000);
  }
  return box;
}

function tickCountdowns() {
  const now = Date.now();
  countdowns.forEach((item) => {
    const left = item.target - now;
    if (left <= 0) {
      if (!item.done) {
        item.done = true;
        item.row.remove();
        item.label.textContent =
          now < item.dayEnd
            ? "It's happening today! Come and join us."
            : "This event has ended. Thank you for coming!";
        item.box.classList.add("is-live");
      }
      return;
    }
    const seconds = Math.floor(left / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    item.cells.days.textContent = String(days);
    item.cells.hours.textContent = String(hours).padStart(2, "0");
    item.cells.mins.textContent = String(mins).padStart(2, "0");
    item.cells.secs.textContent = String(secs).padStart(2, "0");
    item.box.setAttribute(
      "aria-label",
      item.title +
        " starts in " +
        days +
        (days === 1 ? " day " : " days ") +
        hours +
        (hours === 1 ? " hour" : " hours"),
    );
  });
}

/* ---------- Upcoming events (same design for every event) ---------- */

function longDate(dateText) {
  const date = new Date(dateText + "T00:00:00");
  if (Number.isNaN(date.getTime())) {
    return dateText || "";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shorten(text, max) {
  const clean = String(text || "").trim();
  return clean.length > max ? clean.slice(0, max - 1).trim() + "…" : clean;
}

function eventBand(event, withCountdown) {
  const date = new Date(event.event_date + "T00:00:00");
  const validDate = !Number.isNaN(date.getTime());
  const band = el("section", "home-event");

  const badge = el("div", "home-event-date");
  badge.setAttribute("aria-hidden", "true");
  badge.appendChild(
    el("strong", null, validDate ? String(date.getDate()) : ""),
  );
  badge.appendChild(
    el(
      "span",
      null,
      validDate
        ? date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
        : "",
    ),
  );

  const body = el("div");
  body.appendChild(el("h2", null, event.title));
  if (event.description) {
    body.appendChild(el("p", null, shorten(event.description, 170)));
  }
  const meta = [longDate(event.event_date), event.start_time, event.location]
    .filter(Boolean)
    .join("  |  ");
  body.appendChild(el("p", "home-event-meta", meta));
  const prices = (event.tickets || [])
    .map((ticket) => Number(ticket.price))
    .filter((price) => Number.isFinite(price));
  if (prices.length > 0) {
    body.appendChild(
      el(
        "p",
        null,
        "Tickets from NLe " +
          Math.min.apply(null, prices) +
          ". Free food, drinks and water are included. You get a digital ticket with a QR code for quick entry.",
      ),
    );
  }

  if (withCountdown) {
    const countdown = countdownBox(event);
    if (countdown) {
      body.appendChild(countdown);
    }
  }

  const link = el(
    "a",
    "button button-light",
    event.registration_open ? "Register Now" : "See Details",
  );
  link.href = "events.html";
  band.append(badge, body, link);
  return band;
}

async function loadEvents() {
  const fallback = document.querySelector(".home-event");
  if (!fallback) {
    return;
  }
  const events = await callRpc("get_public_events", {});
  if (!Array.isArray(events)) {
    return;
  }
  if (events.length === 0) {
    fallback.remove();
    return;
  }
  let last = fallback;
  const today = freetownToday();
  const next = events.find((event) => String(event.event_date) >= today);
  events.slice(0, 3).forEach((event) => {
    const band = eventBand(event, true);
    last.after(band);
    last = band;
  });
  if (events.length > 3) {
    const more = el("p", "home-actions");
    const link = el("a", "button button-secondary", "See All Upcoming Events");
    link.href = "events.html";
    more.appendChild(link);
    last.after(more);
  }
  fallback.remove();
}

loadEvents().catch((error) => console.error("Home events error:", error));

/* ---------- How-to guides on the home page ---------- */

async function loadGuide() {
  const grid = document.getElementById("home-guide-grid");
  if (!grid) {
    return;
  }
  const result = await callRpc("get_public_gallery", {
    p_section: "guide",
    p_limit: 3,
    p_offset: 0,
  });
  const items = (result && result.items) || [];
  items.forEach((item) => {
    const tile = el("a", "home-guide-tile");
    tile.href = "guide.html";
    tile.setAttribute(
      "aria-label",
      "Open the guide: " + (item.title || "How to use A1 Kitchen"),
    );
    const path =
      item.thumb_path || (item.kind === "photo" ? item.file_path : "");
    if (path) {
      const image = el("img");
      image.src = BUCKET_URL + path;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      tile.appendChild(image);
    } else {
      tile.appendChild(el("span", "gallery-noposter", "Guide"));
    }
    if (item.kind === "video") {
      tile.appendChild(el("span", "play-badge", "▶"));
    }
    if (Number(item.sort_order) > 0) {
      tile.appendChild(el("span", "lesson-number", String(item.sort_order)));
    }
    if (item.title) {
      tile.appendChild(el("span", "home-guide-title", item.title));
    }
    grid.appendChild(tile);
  });
}

loadGuide().catch((error) => console.error("Home guide error:", error));

/* ---------- Today's specials (chosen by staff in the Specials page) ---------- */

function specialPrice(price) {
  if (price === null || price === undefined || price === "") {
    return "Price on request";
  }
  return "NLe " + Number(price).toLocaleString("en-GB");
}

function specialEnds(untilText) {
  if (!untilText || String(untilText).slice(0, 10) <= freetownToday()) {
    return "Today only";
  }
  const date = new Date(String(untilText).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return (
    "Until " +
    date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
  );
}

function specialCard(item) {
  const card = el("article", "special-card");
  const media = el("div", "special-photo");
  if (item.image_path) {
    const image = el("img");
    image.src = item.image_path;
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";
    media.appendChild(image);
  } else {
    media.appendChild(el("span", "special-noimg", "🍲"));
  }
  media.appendChild(
    el("span", "special-ribbon", item.special_note || "Special"),
  );
  card.appendChild(media);

  const body = el("div", "special-body");
  body.appendChild(el("h3", null, item.name));
  if (item.description) {
    body.appendChild(el("p", "special-desc", shorten(item.description, 110)));
  }
  const meta = el("p", "special-meta");
  meta.appendChild(el("strong", null, specialPrice(item.price)));
  meta.appendChild(el("span", null, specialEnds(item.special_until)));
  body.appendChild(meta);
  const link = el("a", "button", "Order Now");
  link.href = "menu.html#add=" + encodeURIComponent(item.name);
  link.setAttribute("aria-label", "Order " + item.name + " from the menu");
  body.appendChild(link);
  card.appendChild(body);
  return card;
}

async function loadSpecials() {
  const items = await callRpc("get_home_specials", {});
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }
  const section = el("section", "home-section home-specials");
  section.id = "home-specials";
  section.setAttribute("aria-labelledby", "home-specials-title");
  const title = el("h2", null, "Today's Specials");
  title.id = "home-specials-title";
  section.appendChild(title);
  section.appendChild(
    el(
      "p",
      "home-lead",
      "Chef A1's picks for today. Order them from the menu while they last.",
    ),
  );
  const grid = el("div", "special-grid");
  items.forEach((item) => grid.appendChild(specialCard(item)));
  section.appendChild(grid);
  const strip = document.querySelector(".home-strip");
  const anchor = strip || document.querySelector(".home-hero");
  if (anchor) {
    anchor.after(section);
  } else {
    document.getElementById("main-content").prepend(section);
  }
}

loadSpecials().catch((error) => console.error("Home specials error:", error));

/* ---------- Customer star ratings (only the ones staff approved) ---------- */

function ratingStars(count, className) {
  const row = el("p", "rating-stars " + (className || ""));
  row.setAttribute("aria-label", count + " out of 5 stars");
  for (let i = 1; i <= 5; i += 1) {
    const star = el(
      "span",
      i <= Math.round(count) ? "star-on" : "star-off",
      "★",
    );
    star.setAttribute("aria-hidden", "true");
    row.appendChild(star);
  }
  return row;
}

function ratingInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "A1";
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

async function loadRatings() {
  const data = await callRpc("get_public_ratings", { p_limit: 12 });
  const items = (data && data.items) || [];
  if (items.length === 0) {
    return;
  }
  const section = el("section", "home-section home-ratings");
  section.id = "home-ratings";
  section.appendChild(el("h2", null, "What Our Customers Say"));
  if (Number(data.count) >= 3 && data.average) {
    const summary = el("div", "rating-summary");
    summary.appendChild(ratingStars(Number(data.average), "rating-stars-big"));
    summary.appendChild(
      el(
        "p",
        "home-lead",
        "Rated " +
          Number(data.average).toFixed(1) +
          " out of 5 by " +
          data.count +
          " customers after their food was delivered.",
      ),
    );
    section.appendChild(summary);
  }
  section.appendChild(
    el(
      "p",
      "rating-hint",
      "Tap a name to read what they said. Tap again to close.",
    ),
  );

  const list = el("div", "rating-list");
  items.forEach((item) => {
    const card = el("details", "rating-toggle");

    const summary = el("summary", "rating-toggle-head");
    const badge = el("span", "rating-toggle-badge", ratingInitials(item.name));
    badge.setAttribute("aria-hidden", "true");
    summary.appendChild(badge);
    summary.appendChild(
      el("span", "rating-toggle-name", item.name || "A1 Kitchen customer"),
    );
    const arrow = el("span", "rating-toggle-arrow", "▾");
    arrow.setAttribute("aria-hidden", "true");
    summary.appendChild(arrow);
    card.appendChild(summary);

    const body = el("div", "rating-toggle-body");
    body.appendChild(ratingStars(Number(item.stars)));
    body.appendChild(
      el(
        "p",
        "rating-toggle-text",
        item.comment
          ? "“" + item.comment + "”"
          : "Gave " + item.stars + " out of 5 stars.",
      ),
    );
    card.appendChild(body);

    list.appendChild(card);
  });
  section.appendChild(list);

  const anchor =
    document.getElementById("home-words") ||
    document.getElementById("home-work") ||
    document.querySelector(".home-event");
  if (anchor) {
    anchor.after(section);
  }
}

loadRatings().catch((error) => console.error("Home ratings error:", error));
