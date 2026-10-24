/* A1 Kitchen: About page pictures and videos (under "Our Vision") */
const aboutMedia = document.getElementById("about-media");
const aboutMore = document.getElementById("about-more");

const BUCKET_URL = SUPABASE_URL + "/storage/v1/object/public/gallery/";
const PAGE_SIZE = 12;
let offset = 0;

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

/* Each upload is shown like the original garden picture:
   large and centred, with its title and writing below it. */
function visionBlock(item) {
  const block = el("article", "vision-block");

  if (item.kind === "video") {
    const video = document.createElement("video");
    video.className = "vision-video";
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    if (item.thumb_path) {
      video.poster = BUCKET_URL + item.thumb_path;
    }
    video.src = BUCKET_URL + item.file_path;
    block.appendChild(video);
  } else {
    const figure = el("figure", "vision");
    const image = el("img");
    image.src = BUCKET_URL + item.file_path;
    image.alt =
      item.title || String(item.caption || "A1 Kitchen").slice(0, 120);
    image.loading = "lazy";
    image.decoding = "async";
    figure.appendChild(image);
    block.appendChild(figure);
  }

  if (item.title) {
    block.appendChild(el("h3", null, item.title));
  }
  String(item.caption || "")
    .split(/\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .forEach((text) => block.appendChild(el("p", null, text)));
  return block;
}

async function load() {
  aboutMore.hidden = true;
  try {
    const result = await callRpc("get_public_gallery", {
      p_section: "about",
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    const items = (result && result.items) || [];
    items.forEach((item) => aboutMedia.appendChild(visionBlock(item)));
    offset += items.length;
    aboutMedia.hidden = offset === 0;
    aboutMore.hidden = !(result && result.has_more);
  } catch (error) {
    console.error("About media error:", error);
  }
}

aboutMore.addEventListener("click", load);
load();
