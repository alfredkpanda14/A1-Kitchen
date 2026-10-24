/* A1 Kitchen: Gallery manager (Developer only) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const uploadBox = document.getElementById("upload-box");
const itemList = document.getElementById("item-list");

const BUCKET = "gallery";
const BUCKET_URL = SUPABASE_URL + "/storage/v1/object/public/gallery/";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_INPUT_BYTES = 40 * 1024 * 1024;
const VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const SECTION_LABELS = {
  work: "Our work",
  testimony: "Customer testimony",
  event: "Event",
  about: "About page (under Our Vision)",
  guide: "How-to guide (How to Use the Website page)",
};

let staff = null;
let items = [];
let eventChoices = [];

/* ---------- Small helpers ---------- */

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

function setMessage(text) {
  dashMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function goTo(page) {
  window.location.href = page;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  if (text.length > 0 && text.length < 160) {
    return text;
  }
  return "Something went wrong. Please try again.";
}

async function rpc(name, params) {
  const { data, error } = await supabaseClient.rpc(name, params || {});
  if (error) {
    if (error.code === "PGRST301" || /jwt/i.test(error.message || "")) {
      goTo("staff-login.html");
    }
    throw new Error(error.message || "Request failed");
  }
  return data;
}

function field(labelText, input, helpText) {
  const wrapper = el("div", "menu-field");
  const label = el("label", null, labelText);
  label.htmlFor = input.id;
  wrapper.append(label, input);
  if (helpText) {
    wrapper.appendChild(el("p", "field-help", helpText));
  }
  return wrapper;
}

function sectionSelect(id, value) {
  const select = el("select");
  select.id = id;
  Object.keys(SECTION_LABELS).forEach((key) => {
    const option = el("option", null, SECTION_LABELS[key]);
    option.value = key;
    option.selected = key === value;
    select.appendChild(option);
  });
  return select;
}

function eventSelect(id, value) {
  const select = el("select");
  select.id = id;
  const none = el("option", null, "Not linked to an event");
  none.value = "";
  select.appendChild(none);
  eventChoices.forEach((event) => {
    const option = el("option", null, event.title);
    option.value = event.id;
    option.selected = event.id === value;
    select.appendChild(option);
  });
  return select;
}

/* ---------- Picture and video preparation (runs on the phone) ---------- */

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "This picture could not be read. Please try a JPG, PNG or WebP picture.",
        ),
      );
    };
    image.src = url;
  });
}

async function shrink(source, width, height, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  let blob = await canvasToBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  if (!blob) {
    throw new Error("The picture could not be prepared.");
  }
  return blob;
}

function extensionOf(blob) {
  return blob.type === "image/webp" ? "webp" : "jpg";
}

function captureVideoFrame(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let finished = false;
    function done(blob) {
      if (finished) {
        return;
      }
      finished = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      } catch (error) {
        done(null);
      }
    };
    video.onseeked = async () => {
      try {
        done(
          await shrink(video, video.videoWidth, video.videoHeight, 480, 0.75),
        );
      } catch (error) {
        done(null);
      }
    };
    video.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    video.src = url;
  });
}

async function uploadBlob(path, blob, contentType) {
  const { error } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) {
    throw new Error(
      "The upload failed. Please check your internet and try again.",
    );
  }
}

async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (list.length === 0) {
    return;
  }
  try {
    await supabaseClient.storage.from(BUCKET).remove(list);
  } catch (error) {
    console.error("Could not remove files:", error);
  }
}

/* ---------- Upload card ---------- */

function buildUploadCard() {
  uploadBox.textContent = "";
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Add photos or a video"));
  card.appendChild(
    el(
      "p",
      null,
      "Photos are made smaller automatically before they are sent. Videos can be up to 50 MB and do not load on the website until someone presses play.",
    ),
  );

  const section = sectionSelect("up-section", "work");
  const eventPick = eventSelect("up-event", "");
  const eventField = field("Which event?", eventPick);
  eventField.hidden = true;
  const title = el("input");
  title.id = "up-title";
  title.type = "text";
  title.maxLength = 120;
  title.autocomplete = "off";
  const caption = el("textarea");
  caption.id = "up-caption";
  caption.rows = 3;
  caption.maxLength = 3000;
  const person = el("input");
  person.id = "up-person";
  person.type = "text";
  person.maxLength = 80;
  person.autocomplete = "off";
  const personField = field('Customer\'s name (shown as "Shared by")', person);
  personField.hidden = true;
  const sortInput = el("input");
  sortInput.id = "up-sort";
  sortInput.type = "number";
  sortInput.min = "0";
  sortInput.max = "999";
  sortInput.step = "1";
  sortInput.inputMode = "numeric";
  sortInput.value = "1";
  const sortField = field(
    "Order on the page (1 shows first)",
    sortInput,
    "Lessons are shown in this order on the How to Use the Website page. Use 1, 2, 3...",
  );
  sortField.hidden = true;

  const files = el("input");
  files.id = "up-files";
  files.type = "file";
  files.multiple = true;
  files.accept = "image/*,video/mp4,video/webm,video/quicktime";
  const cover = el("input");
  cover.id = "up-cover";
  cover.type = "file";
  cover.accept = "image/*";

  const published = el("input");
  published.id = "up-published";
  published.type = "checkbox";
  published.checked = true;
  const publishedLabel = el("label", "checkbox-label");
  publishedLabel.htmlFor = published.id;
  publishedLabel.append(
    published,
    document.createTextNode(" Show on the website now"),
  );

  section.addEventListener("change", () => {
    eventField.hidden = section.value !== "event";
    personField.hidden = section.value !== "testimony";
    sortField.hidden = section.value !== "guide" && section.value !== "about";
  });

  const progress = el("p", "success-message");
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-live", "polite");

  const button = el("button", "button", "Upload");
  button.type = "button";
  let busy = false;

  button.addEventListener("click", async () => {
    if (busy) {
      return;
    }
    const chosen = Array.from(files.files || []);
    if (chosen.length === 0) {
      progress.textContent = "Please choose at least one photo or video.";
      return;
    }
    const videos = chosen.filter((file) => file.type.startsWith("video/"));
    if (videos.length > 0 && chosen.length > 1) {
      progress.textContent =
        "Please upload a video on its own, without other files.";
      return;
    }
    busy = true;
    button.disabled = true;
    let done = 0;
    const failed = [];
    for (const file of chosen) {
      progress.textContent =
        "Uploading " + (done + 1) + " of " + chosen.length + "...";
      try {
        await uploadOne(file, {
          section: section.value,
          eventId: section.value === "event" ? eventPick.value : "",
          title: title.value.trim(),
          caption: caption.value.trim(),
          person: section.value === "testimony" ? person.value.trim() : "",
          published: published.checked,
          coverFile: (cover.files || [])[0] || null,
          sortOrder:
            section.value === "guide" ? Number(sortInput.value) || 0 : 0,
        });
        done += 1;
      } catch (error) {
        console.error("Upload failed:", error);
        failed.push(file.name + ": " + friendlyError(error));
      }
    }
    busy = false;
    button.disabled = false;
    if (failed.length === 0) {
      progress.textContent =
        done + (done === 1 ? " item" : " items") + " uploaded.";
      files.value = "";
      cover.value = "";
      title.value = "";
      caption.value = "";
      person.value = "";
      if (section.value === "guide") {
        sortInput.value = String((Number(sortInput.value) || 0) + 1);
      }
    } else {
      progress.textContent = done + " uploaded. Problem: " + failed.join(" | ");
    }
    try {
      await loadItems();
    } catch (error) {
      setMessage(friendlyError(error));
    }
  });

  card.append(
    field("Where should it appear?", section),
    eventField,
    field("Title (optional)", title),
    field("Short description (optional)", caption),
    personField,
    sortField,
    field(
      "Photos or video",
      files,
      "You can choose several photos at once. A video must be sent alone.",
    ),
    field(
      "Cover picture for a video (optional)",
      cover,
      "If you skip this, the website picks a picture from the video.",
    ),
    publishedLabel,
    button,
    progress,
  );
  uploadBox.appendChild(card);
}

async function uploadOne(file, details) {
  const isVideo = file.type.startsWith("video/");
  const id = crypto.randomUUID();
  const uploaded = [];
  try {
    let filePath = "";
    let thumbPath = "";
    if (isVideo) {
      const extension = VIDEO_EXTENSIONS[file.type];
      if (!extension) {
        throw new Error("Please use an MP4, WebM or MOV video.");
      }
      if (file.size > MAX_VIDEO_BYTES) {
        throw new Error(
          "This video is bigger than 50 MB. Please make it shorter or smaller.",
        );
      }
      filePath = "videos/" + id + "." + extension;
      let thumb = null;
      if (details.coverFile) {
        const coverImage = await loadImageFile(details.coverFile);
        thumb = await shrink(
          coverImage,
          coverImage.naturalWidth,
          coverImage.naturalHeight,
          480,
          0.75,
        );
      } else {
        thumb = await captureVideoFrame(file);
      }
      await uploadBlob(filePath, file, file.type);
      uploaded.push(filePath);
      if (thumb) {
        thumbPath = "thumbs/" + id + "." + extensionOf(thumb);
        await uploadBlob(thumbPath, thumb, thumb.type);
        uploaded.push(thumbPath);
      }
    } else {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose a picture or a video.");
      }
      if (file.size > MAX_IMAGE_INPUT_BYTES) {
        throw new Error("This picture is too large.");
      }
      const image = await loadImageFile(file);
      const full = await shrink(
        image,
        image.naturalWidth,
        image.naturalHeight,
        1600,
        0.8,
      );
      const thumb = await shrink(
        image,
        image.naturalWidth,
        image.naturalHeight,
        480,
        0.75,
      );
      filePath = "photos/" + id + "." + extensionOf(full);
      thumbPath = "thumbs/" + id + "." + extensionOf(thumb);
      await uploadBlob(filePath, full, full.type);
      uploaded.push(filePath);
      await uploadBlob(thumbPath, thumb, thumb.type);
      uploaded.push(thumbPath);
    }
    await rpc("staff_add_gallery_item", {
      p_kind: isVideo ? "video" : "photo",
      p_section: details.section,
      p_title: details.title || null,
      p_caption: details.caption || null,
      p_person: details.person || null,
      p_file_path: filePath,
      p_thumb_path: thumbPath || null,
      p_event_id: details.eventId || null,
      p_published: details.published,
      p_sort_order: details.sortOrder || 0,
    });
  } catch (error) {
    await removeFiles(uploaded);
    throw error;
  }
}

/* ---------- Existing items ---------- */

function itemCard(item) {
  const card = el("div", "card order-card");
  const thumbPath =
    item.thumb_path || (item.kind === "photo" ? item.file_path : "");
  if (thumbPath) {
    const image = el("img", "gallery-admin-thumb");
    image.src = BUCKET_URL + thumbPath;
    image.alt = item.title || "Gallery picture";
    image.loading = "lazy";
    card.appendChild(image);
  } else {
    card.appendChild(el("p", null, "Video (no cover picture)"));
  }
  const badges = el("p");
  badges.appendChild(
    el("span", "badge", item.kind === "video" ? "Video" : "Photo"),
  );
  badges.appendChild(
    el(
      "span",
      "badge " + (item.published ? "badge-good" : "badge-warn"),
      item.published ? "Shown" : "Hidden",
    ),
  );
  badges.appendChild(el("span", "badge", formatDate(item.created_at)));
  card.appendChild(badges);

  const key = "gi-" + item.id;
  const section = sectionSelect(key + "-section", item.section);
  const eventPick = eventSelect(key + "-event", item.event_id || "");
  const title = el("input");
  title.id = key + "-title";
  title.type = "text";
  title.maxLength = 120;
  title.value = item.title || "";
  const caption = el("textarea");
  caption.id = key + "-caption";
  caption.rows = 2;
  caption.maxLength = 3000;
  caption.value = item.caption || "";
  const person = el("input");
  person.id = key + "-person";
  person.type = "text";
  person.maxLength = 80;
  person.value = item.person_name || "";
  const published = el("input");
  published.id = key + "-published";
  published.type = "checkbox";
  published.checked = item.published;
  const publishedLabel = el("label", "checkbox-label");
  publishedLabel.htmlFor = published.id;
  publishedLabel.append(
    published,
    document.createTextNode(" Show on the website"),
  );
  const sortInput = el("input");
  sortInput.id = key + "-sort";
  sortInput.type = "number";
  sortInput.min = "0";
  sortInput.max = "999";
  sortInput.step = "1";
  sortInput.inputMode = "numeric";
  sortInput.value = String(item.sort_order || 0);

  const save = el("button", "button", "Save changes");
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    setMessage("Saving...");
    try {
      await rpc("staff_update_gallery_item", {
        p_id: item.id,
        p_section: section.value,
        p_title: title.value.trim() || null,
        p_caption: caption.value.trim() || null,
        p_person: person.value.trim() || null,
        p_event_id: section.value === "event" ? eventPick.value || null : null,
        p_published: published.checked,
        p_sort_order: Number(sortInput.value) || 0,
      });
      await loadItems();
      setMessage("Saved.");
    } catch (error) {
      setMessage(friendlyError(error));
      save.disabled = false;
    }
  });

  const remove = el("button", "button button-danger", "Delete");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (
      !window.confirm(
        "Delete this " +
          item.kind +
          " from the website? This cannot be undone.",
      )
    ) {
      return;
    }
    remove.disabled = true;
    setMessage("Deleting...");
    try {
      const result = await rpc("staff_delete_gallery_item", { p_id: item.id });
      await removeFiles([result.file_path, result.thumb_path]);
      await loadItems();
      setMessage("Deleted.");
    } catch (error) {
      setMessage(friendlyError(error));
      remove.disabled = false;
    }
  });

  card.append(
    field("Where it appears", section),
    field("Event", eventPick),
    field("Title", title),
    field("Short description", caption),
    field("Customer's name (testimonies)", person),
    field(
      "Order on the page (About page and guides; 1 shows first)",
      sortInput,
    ),
    publishedLabel,
    save,
    remove,
  );
  return card;
}

function render() {
  itemList.textContent = "";
  if (items.length === 0) {
    itemList.appendChild(el("p", null, "Nothing has been uploaded yet."));
    return;
  }
  items.forEach((item) => itemList.appendChild(itemCard(item)));
}

async function loadItems() {
  items = (await rpc("staff_list_gallery")) || [];
  render();
}

/* ---------- Start ---------- */

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

refreshButton.addEventListener("click", async () => {
  setMessage("Loading...");
  try {
    await loadItems();
    setMessage("");
  } catch (error) {
    setMessage(friendlyError(error));
  }
});

async function start() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data || !data.session) {
    goTo("staff-login.html");
    return;
  }
  const { data: info, error } = await supabaseClient.rpc("my_staff_info");
  if (error || !info) {
    await supabaseClient.auth.signOut();
    goTo("staff-login.html");
    return;
  }
  staff = info;
  if (!can("gallery.manage")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-menu").hidden = !can("menu.manage");
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  document.getElementById("nav-events").hidden = !can("events.view");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    staff.role.replace("_", " ") +
    ")";

  if (can("events.view")) {
    try {
      const events = (await rpc("staff_list_events")) || [];
      eventChoices = events.map((event) => ({
        id: event.id,
        title: event.title,
      }));
    } catch (error2) {
      console.error("Could not load events:", error2);
    }
  }
  buildUploadCard();
  setMessage("Loading...");
  try {
    await loadItems();
    setMessage("");
  } catch (loadError) {
    console.error("Load error:", loadError);
    setMessage(friendlyError(loadError));
  }
}

start();
