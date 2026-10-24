/* A1 Kitchen: home page extras (latest photos and customer words) */
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

function eventBand(event) {
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
  events.slice(0, 3).forEach((event) => {
    const band = eventBand(event);
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
