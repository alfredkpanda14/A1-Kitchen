/* A1 Kitchen: competition registration and the participant's own page */
const compMessage = document.getElementById("comp-message");
const compView = document.getElementById("comp-view");

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTRY_KEY = "a1KitchenCompetitionEntry";
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_PROOF_BYTES = 6 * 1024 * 1024;
const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let pollTimer = null;

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

function say(text) {
  compMessage.textContent = text || "";
}

function money(value) {
  return "NLe " + Number(value || 0);
}

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

function line(parent, label, value) {
  if (!value) {
    return;
  }
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function info(key) {
  return typeof SITE_INFO !== "undefined" && SITE_INFO[key]
    ? SITE_INFO[key]
    : "";
}

function isValidPhone(value) {
  if (!/^\+?[0-9\s\-()]+$/.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
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
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }
  if (!response.ok) {
    throw new Error((body && body.message) || "Request failed");
  }
  return body;
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "We could not reach A1 Kitchen. Please check your internet connection and try again.";
  }
  if (text.includes("already registered")) {
    return "This phone number is already registered for this competition. Open your page with the link you saved, or contact A1 Kitchen.";
  }
  if (text.length > 0 && text.length < 170 && !text.includes("invalid input")) {
    return text;
  }
  return "Something went wrong. Please try again, or contact A1 Kitchen.";
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- Photo: cropped and made small on the phone ---------- */

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
          "This picture could not be read. Please choose a JPG or PNG photo.",
        ),
      );
    };
    image.src = url;
  });
}

function cropToDataUrl(image, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const targetRatio = width / height;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sw;
  let sh;
  let sx;
  let sy;
  if (sourceRatio > targetRatio) {
    sh = image.naturalHeight;
    sw = sh * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = image.naturalWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = Math.max(0, (image.naturalHeight - sh) * 0.25);
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function makePhotos(file) {
  const image = await loadImageFile(file);
  let photo = "";
  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    photo = cropToDataUrl(image, 300, 400, quality);
    if (photo.length <= 110000) {
      break;
    }
  }
  const thumb = cropToDataUrl(image, 60, 80, 0.7);
  if (photo.length > 115000 || !photo.startsWith("data:image/jpeg;base64,")) {
    throw new Error("This photo is too detailed. Please take a simpler photo.");
  }
  return { photo: photo, thumb: thumb };
}

/* ---------- QR code drawn on the page ---------- */

function qrSvg(text) {
  const qr = A1Qr.make(text, "M");
  const quiet = 4;
  const size = qr.size + quiet * 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR code for your competitor ticket");
  svg.setAttribute("class", "qr-svg");
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", String(size));
  background.setAttribute("height", String(size));
  background.setAttribute("fill", "#ffffff");
  svg.appendChild(background);
  let d = "";
  for (let row = 0; row < qr.size; row += 1) {
    let col = 0;
    while (col < qr.size) {
      if (qr.isDark(col, row)) {
        let end = col;
        while (end + 1 < qr.size && qr.isDark(end + 1, row)) {
          end += 1;
        }
        d +=
          "M" +
          (col + quiet) +
          " " +
          (row + quiet) +
          "h" +
          (end - col + 1) +
          "v1h-" +
          (end - col + 1) +
          "z";
        col = end + 1;
      } else {
        col += 1;
      }
    }
  }
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000000");
  path.setAttribute("shape-rendering", "crispEdges");
  svg.appendChild(path);
  return svg;
}

/* ---------- Registration ---------- */

function competitionCard(comp) {
  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, comp.title));
  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge",
      comp.kind === "cooking" ? "Cooking competition" : "Eating competition",
    ),
  );
  card.appendChild(badges);
  line(card, "Date:", longDate(comp.event_date));
  line(card, "Time:", comp.start_time);
  line(card, "Where:", comp.location);
  if (comp.description) {
    card.appendChild(el("p", null, comp.description));
  }
  if (comp.prize_first || comp.prize_second) {
    const prizes = el("div", "included-box");
    prizes.appendChild(el("strong", null, "Prizes"));
    if (comp.prize_first) {
      prizes.appendChild(el("p", null, "1st place: " + comp.prize_first));
    }
    if (comp.prize_second) {
      prizes.appendChild(el("p", null, "2nd place: " + comp.prize_second));
    }
    card.appendChild(prizes);
  }
  card.appendChild(
    el(
      "p",
      "menu-notice",
      Number(comp.fee) > 0
        ? "Registration fee: " +
            money(comp.fee) +
            ". You pay after you register."
        : "Free to enter. There is no registration fee.",
    ),
  );
  return card;
}

function registerView(comp) {
  compView.textContent = "";
  compView.appendChild(competitionCard(comp));
  if (!comp.registration_open) {
    compView.appendChild(
      el(
        "p",
        "menu-notice",
        "Registration for this competition is closed or full. Please contact A1 Kitchen.",
      ),
    );
    return;
  }

  const form = el("div", "card order-card");
  form.appendChild(el("h3", null, "Register to compete"));
  form.appendChild(
    el(
      "p",
      null,
      "Fill in your details and add a clear photo of your face. A1 Kitchen checks every registration, and your approved competitor ticket (with your photo and a QR code) appears on your page.",
    ),
  );

  const name = el("input");
  name.id = "comp-name";
  name.type = "text";
  name.maxLength = 100;
  name.autocomplete = "name";
  const nameLabel = el("label", null, "Full name *");
  nameLabel.htmlFor = name.id;
  const phone = el("input");
  phone.id = "comp-phone";
  phone.type = "tel";
  phone.maxLength = 20;
  phone.autocomplete = "tel";
  phone.inputMode = "tel";
  const phoneLabel = el("label", null, "Phone number (WhatsApp if possible) *");
  phoneLabel.htmlFor = phone.id;
  const picture = el("input");
  picture.id = "comp-photo";
  picture.type = "file";
  picture.accept = "image/*";
  const pictureLabel = el(
    "label",
    null,
    "Your photo * (a clear photo of your face)",
  );
  pictureLabel.htmlFor = picture.id;
  const preview = el("img", "photo-preview");
  preview.alt = "Preview of your photo";
  preview.hidden = true;
  let photos = null;

  picture.addEventListener("change", async () => {
    photos = null;
    preview.hidden = true;
    const file = (picture.files || [])[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      message.textContent = "Please choose a photo.";
      return;
    }
    try {
      message.textContent = "Preparing your photo...";
      photos = await makePhotos(file);
      preview.src = photos.photo;
      preview.hidden = false;
      message.textContent = "";
    } catch (error) {
      message.textContent = friendlyError(error);
    }
  });

  const formStart = Date.now();
  const honeypot = el("input", "hp-field");
  honeypot.type = "text";
  honeypot.name = "website";
  honeypot.tabIndex = -1;
  honeypot.autocomplete = "off";
  honeypot.setAttribute("aria-hidden", "true");

  const rules = el(
    "p",
    "field-help",
    "A1 Kitchen wants everyone to have the chance to show their skills. Registration fees are not refunded. If a registration is not approved, there is no refund. Your photo is printed on your competitor ticket and shown to our staff. If you win, your name and place are shown on our Competitions page and on your certificate.",
  );
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const submit = el("button", "button", "Register");
  submit.type = "button";
  let busy = false;

  submit.addEventListener("click", async () => {
    if (busy) {
      return;
    }
    if (honeypot.value) {
      return;
    }
    if (Date.now() - formStart < 2500) {
      message.textContent =
        "Please take a moment to check your details, then press the button again.";
      return;
    }
    if (name.value.trim().length < 2) {
      message.textContent = "Please enter your full name.";
      name.focus();
      return;
    }
    if (!isValidPhone(phone.value.trim())) {
      message.textContent =
        "Please enter a valid phone number, for example +232 79 123456.";
      phone.focus();
      return;
    }
    if (!photos) {
      message.textContent = "Please add your photo.";
      picture.focus();
      return;
    }
    busy = true;
    submit.disabled = true;
    message.textContent = "Registering...";
    try {
      const result = await callRpc("register_competition_entry", {
        p_competition_id: comp.id,
        p_full_name: name.value.trim(),
        p_phone: phone.value.trim(),
        p_photo: photos.photo,
        p_thumb: photos.thumb,
      });
      localStorage.setItem(ENTRY_KEY, result.access_code);
      window.location.hash = "#g=" + result.access_code;
    } catch (error) {
      console.error("Register failed:", error);
      message.textContent = friendlyError(error);
      busy = false;
      submit.disabled = false;
    }
  });

  form.append(
    nameLabel,
    name,
    phoneLabel,
    phone,
    pictureLabel,
    picture,
    preview,
    honeypot,
    rules,
    submit,
    message,
  );
  compView.appendChild(form);
}

async function showCompetition(id) {
  say("Loading...");
  try {
    const list = await callRpc("get_public_competitions", {});
    const comp = (list || []).find((item) => item.id === id);
    if (!comp) {
      say(
        "We could not find this competition. Please go back to the Competitions page.",
      );
      return;
    }
    say("");
    registerView(comp);
  } catch (error) {
    console.error("Competition error:", error);
    say(
      "We could not load this competition. Please check your internet connection and try again.",
    );
  }
}

/* ---------- The participant's own page ---------- */

function proofForm(entry, code) {
  const box = el("div", "photo-box");
  box.appendChild(
    el("h4", null, "Pay your registration fee: " + money(entry.fee_amount)),
  );
  const orange = info("orangeMoneyNumber");
  const afri = info("afrimoneyNumber");
  box.appendChild(
    el(
      "p",
      null,
      "Send " +
        money(entry.fee_amount) +
        " with Orange Money" +
        (orange ? " to " + orange : "") +
        " or AfriMoney" +
        (afri ? " to " + afri : "") +
        ", then upload a screenshot of your payment. A1 Kitchen will check it and approve your registration.",
    ),
  );
  const method = el("select");
  method.id = "comp-method";
  ["Orange Money", "AfriMoney"].forEach((value) => {
    const option = el("option", null, value);
    option.value = value;
    method.appendChild(option);
  });
  const methodLabel = el("label", null, "How did you pay?");
  methodLabel.htmlFor = method.id;
  const file = el("input");
  file.id = "comp-proof";
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  const fileLabel = el(
    "label",
    null,
    "Screenshot of your payment * (up to 6 MB)",
  );
  fileLabel.htmlFor = file.id;
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const send = el(
    "button",
    "button",
    entry.payment_sent
      ? "Send a new screenshot"
      : "Send my payment for checking",
  );
  send.type = "button";
  send.addEventListener("click", async () => {
    const picked = (file.files || [])[0];
    if (!picked) {
      message.textContent = "Please choose your payment screenshot.";
      return;
    }
    const extension = EXTENSION_BY_TYPE[picked.type];
    if (!extension) {
      message.textContent = "Please upload a JPG, PNG or WebP image.";
      return;
    }
    if (picked.size > MAX_PROOF_BYTES) {
      message.textContent =
        "The screenshot is too large. Please use an image below 6 MB.";
      return;
    }
    if (!supabaseClient) {
      message.textContent =
        "The page could not start the upload. Please refresh and try again.";
      return;
    }
    send.disabled = true;
    message.textContent = "Uploading...";
    const path = code + "/" + crypto.randomUUID() + "." + extension;
    try {
      const upload = await supabaseClient.storage
        .from("competition-proof")
        .upload(path, picked, {
          contentType: picked.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upload.error) {
        throw new Error(
          "The screenshot could not be uploaded. Please try again.",
        );
      }
      await callRpc("submit_competition_payment", {
        p_access_code: code,
        p_method: method.value,
        p_path: path,
        p_hash: await fileHash(picked),
      });
      await loadEntry(
        code,
        "Thank you. Your payment screenshot was received and will be checked.",
      );
    } catch (error) {
      console.error("Payment upload failed:", error);
      message.textContent = friendlyError(error);
      send.disabled = false;
    }
  });
  box.append(methodLabel, method, fileLabel, file, send, message);
  return box;
}

function ticketFor(entry) {
  const comp = entry.competition;
  return {
    kind: comp.kind,
    competitionTitle: comp.title,
    eventDate: comp.event_date,
    startTime: comp.start_time || "",
    location: comp.location || "",
    ticketNumber: entry.ticket_number,
    holder: entry.full_name,
    phone: entry.phone,
    fee: entry.fee_amount,
    contact: info("phone"),
    photo: entry.photo,
    verifyUrl: window.location.origin + "/gate.html#t=" + entry.ticket_number,
  };
}

function entryView(entry, code) {
  compView.textContent = "";
  const comp = entry.competition;
  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, "Hello, " + entry.full_name));
  card.appendChild(el("h3", null, comp.title));
  line(card, "Date:", longDate(comp.event_date));
  line(card, "Time:", comp.start_time);
  line(card, "Where:", comp.location);
  const photo = el("img", "photo-preview");
  photo.src = entry.photo;
  photo.alt = "Your photo";
  card.appendChild(photo);
  compView.appendChild(card);

  if (entry.place) {
    const win = el("div", "included-box");
    win.appendChild(
      el(
        "strong",
        null,
        "Congratulations! You won " +
          (entry.place === 1 ? "1st" : "2nd") +
          " place.",
      ),
    );
    if (entry.prize) {
      win.appendChild(el("p", null, "Your prize: " + entry.prize));
    }
    win.appendChild(
      el("p", null, "A1 Kitchen will give you your certificate."),
    );
    compView.appendChild(win);
  }

  if (entry.status === "Rejected") {
    compView.appendChild(
      el(
        "p",
        "duplicate-warning",
        "Your registration was not approved" +
          (entry.reject_reason ? ": " + entry.reject_reason : ".") +
          " Registration fees are not refunded. Please contact A1 Kitchen if you have a question.",
      ),
    );
    return;
  }

  if (Number(entry.fee_amount) > 0 && entry.status === "Pending") {
    if (entry.payment_sent) {
      compView.appendChild(
        el(
          "p",
          "menu-notice",
          "Your payment screenshot was received. A1 Kitchen is checking your registration. Keep this page open. It updates by itself.",
        ),
      );
    }
    compView.appendChild(proofForm(entry, code));
    return;
  }

  if (entry.status === "Pending") {
    compView.appendChild(
      el(
        "p",
        "menu-notice",
        "Thank you. A1 Kitchen is checking your registration. Keep this page open. It updates by itself when you are approved.",
      ),
    );
    return;
  }

  // Approved
  compView.appendChild(
    el(
      "p",
      "success-message",
      "You are approved! Your competitor ticket is ready.",
    ),
  );
  const ticketBox = el("div", "card order-card");
  ticketBox.appendChild(el("h3", null, "Your competitor ticket"));
  line(ticketBox, "Ticket number:", entry.ticket_number);
  const verifyUrl =
    window.location.origin + "/gate.html#t=" + entry.ticket_number;
  ticketBox.appendChild(qrSvg(verifyUrl));
  const download = el("button", "button", "Download my ticket (PDF)");
  download.type = "button";
  download.addEventListener("click", async () => {
    download.disabled = true;
    try {
      await A1CompPdf.downloadTicket(
        ticketFor(entry),
        "A1-Competitor-Ticket-" + entry.ticket_number + ".pdf",
      );
    } catch (error) {
      console.error("Ticket PDF error:", error);
      say(
        "We could not prepare the ticket. Please take a screenshot of your QR code instead.",
      );
    }
    download.disabled = false;
  });
  ticketBox.appendChild(download);
  ticketBox.appendChild(
    el(
      "p",
      "field-help",
      "Show this ticket at the gate on the day. Staff will check your photo.",
    ),
  );
  compView.appendChild(ticketBox);
}

async function loadEntry(code, successText) {
  stopPolling();
  say("Loading...");
  try {
    const entry = await callRpc("get_competition_entry", {
      p_access_code: code,
    });
    say(successText || "");
    entryView(entry, code);
    if (entry.status === "Pending") {
      pollTimer = setInterval(async () => {
        if (document.hidden) {
          return;
        }
        try {
          const fresh = await callRpc("get_competition_entry", {
            p_access_code: code,
          });
          if (fresh.status !== "Pending") {
            stopPolling();
            entryView(fresh, code);
          }
        } catch (error) {
          /* try again next time */
        }
      }, 10000);
    }
  } catch (error) {
    console.error("Entry error:", error);
    if ((error.message || "").includes("not found")) {
      try {
        localStorage.removeItem(ENTRY_KEY);
      } catch (storageError) {
        /* ignore */
      }
      say(
        "We could not find that registration. Please start again from the Competitions page.",
      );
      compView.textContent = "";
    } else {
      say(
        "We could not load your page. Please check your internet connection and try again.",
      );
    }
  }
}

/* ---------- Start ---------- */

function route() {
  stopPolling();
  compView.textContent = "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const entryCode = (params.get("g") || "").trim().toLowerCase();
  const competitionId = (params.get("c") || "").trim().toLowerCase();
  if (TOKEN_PATTERN.test(entryCode)) {
    loadEntry(entryCode);
    return;
  }
  if (TOKEN_PATTERN.test(competitionId)) {
    showCompetition(competitionId);
    return;
  }
  let saved = "";
  try {
    saved = (localStorage.getItem(ENTRY_KEY) || "").toLowerCase();
  } catch (error) {
    saved = "";
  }
  if (TOKEN_PATTERN.test(saved)) {
    window.location.hash = "#g=" + saved;
    return;
  }
  say("Please choose a competition on the Competitions page to register.");
}

window.addEventListener("hashchange", route);
route();
