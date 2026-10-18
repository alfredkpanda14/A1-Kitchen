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
