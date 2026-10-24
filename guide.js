/* A1 Kitchen: "How to Use the Website" page (videos and picture guides) */
const videoGrid = document.getElementById("guide-videos-grid");
const photoGrid = document.getElementById("guide-photos-grid");
const videoSection = document.getElementById("guide-videos");
const photoSection = document.getElementById("guide-photos");
const emptyBox = document.getElementById("guide-empty");
const moreButton = document.getElementById("guide-more");
const guideMessage = document.getElementById("guide-message");
const photoDialog = document.getElementById("photo-dialog");
const photoDialogImage = document.getElementById("photo-dialog-image");
const photoDialogCaption = document.getElementById("photo-dialog-caption");
const photoDialogClose = document.getElementById("photo-dialog-close");

const BUCKET_URL = SUPABASE_URL + "/storage/v1/object/public/gallery/";
const PAGE_SIZE = 24;
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
  return item.title || item.caption || "A1 Kitchen guide";
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
    button.setAttribute("aria-label", "Open picture: " + altText(item));
    button.addEventListener("click", () => openPhoto(item));
  }
  holder.appendChild(button);
  return holder;
}

function lessonCard(item) {
  const card = el("div", "card lesson-card");
  if (Number(item.sort_order) > 0) {
    card.appendChild(el("span", "lesson-number", String(item.sort_order)));
  }
  card.appendChild(mediaFor(item));
  if (item.title) {
    card.appendChild(el("h3", null, item.title));
  }
  if (item.caption) {
    card.appendChild(el("p", null, item.caption));
  }
  return card;
}

async function load() {
  moreButton.hidden = true;
  guideMessage.textContent = offset === 0 ? "Loading the guides..." : "";
  try {
    const result = await callRpc("get_public_gallery", {
      p_section: "guide",
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    guideMessage.textContent = "";
    const items = (result && result.items) || [];
    items.forEach((item) => {
      (item.kind === "video" ? videoGrid : photoGrid).appendChild(
        lessonCard(item),
      );
    });
    offset += items.length;
    videoSection.hidden = videoGrid.children.length === 0;
    photoSection.hidden = photoGrid.children.length === 0;
    emptyBox.hidden = offset !== 0;
    moreButton.hidden = !(result && result.has_more);
  } catch (error) {
    console.error("Guide load error:", error);
    guideMessage.textContent =
      "We could not load the guides. Please check your internet connection and try again.";
  }
}

moreButton.addEventListener("click", load);

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
