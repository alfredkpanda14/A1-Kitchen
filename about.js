/* A1 Kitchen: About page pictures and videos (under "Our Vision") */
const aboutMedia = document.getElementById("about-media");
const aboutMore = document.getElementById("about-more");
const photoDialog = document.getElementById("photo-dialog");
const photoDialogImage = document.getElementById("photo-dialog-image");
const photoDialogCaption = document.getElementById("photo-dialog-caption");
const photoDialogClose = document.getElementById("photo-dialog-close");

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

function altText(item) {
  return item.title || item.caption || "A1 Kitchen photo";
}

function openPhoto(item) {
  const url = BUCKET_URL + item.file_path;
  if (!photoDialog || typeof photoDialog.showModal !== "function") {
    window.open(url, "_blank", "noopener");
    return;
  }
  photoDialogImage.src = url;
  photoDialogImage.alt = altText(item);
  photoDialogCaption.textContent = [item.title, item.caption]
    .filter(Boolean)
    .join(": ");
  photoDialog.showModal();
}

function playVideo(item, holder) {
  const video = document.createElement("video");
  video.className = "gallery-video-player";
  video.controls = true;
  video.playsInline = true;
  video.preload = "none";
  if (item.thumb_path) {
    video.poster = BUCKET_URL + item.thumb_path;
  }
  video.src = BUCKET_URL + item.file_path;
  holder.textContent = "";
  holder.appendChild(video);
  const started = video.play();
  if (started && typeof started.catch === "function") {
    started.catch(() => {
      /* the person can press play themselves */
    });
  }
}

function mediaFor(item) {
  const holder = el("div", "gallery-media");
  const button = el("button", "gallery-thumb");
  button.type = "button";
  const thumbPath =
    item.thumb_path || (item.kind === "photo" ? item.file_path : "");
  if (thumbPath) {
    const image = el("img");
    image.src = BUCKET_URL + thumbPath;
    image.alt = item.kind === "photo" ? altText(item) : "";
    image.loading = "lazy";
    image.decoding = "async";
    button.appendChild(image);
  } else {
    button.appendChild(el("span", "gallery-noposter", "Video"));
  }
  if (item.kind === "video") {
    button.setAttribute("aria-label", "Play video: " + altText(item));
    button.appendChild(el("span", "play-badge", "▶"));
    button.addEventListener("click", () => playVideo(item, holder));
  } else {
    button.setAttribute("aria-label", "Open photo: " + altText(item));
    button.addEventListener("click", () => openPhoto(item));
  }
  holder.appendChild(button);
  return holder;
}

function card(item) {
  const node = el("div", "card gallery-card");
  node.appendChild(mediaFor(item));
  if (item.title) {
    node.appendChild(el("h3", null, item.title));
  }
  if (item.caption) {
    node.appendChild(el("p", null, item.caption));
  }
  return node;
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
    items.forEach((item) => aboutMedia.appendChild(card(item)));
    offset += items.length;
    aboutMedia.hidden = offset === 0;
    aboutMore.hidden = !(result && result.has_more);
  } catch (error) {
    console.error("About media error:", error);
  }
}

aboutMore.addEventListener("click", load);

if (photoDialog) {
  photoDialogClose.addEventListener("click", () => photoDialog.close());
  photoDialog.addEventListener("click", (event) => {
    if (event.target === photoDialog) {
      photoDialog.close();
    }
  });
  photoDialog.addEventListener("close", () => {
    photoDialogImage.removeAttribute("src");
  });
}

load();
