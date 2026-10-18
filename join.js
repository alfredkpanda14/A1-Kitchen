/* A1 Kitchen: guest page for catering events (register, wait for approval, food tickets) */
const joinMessage = document.getElementById("join-message");
const joinView = document.getElementById("join-view");

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_KEY = "a1KitchenCateringGuest";
const SVG_NS = "http://www.w3.org/2000/svg";

let pollTimer = null;
let currentGuestCode = "";

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
  joinMessage.textContent = text || "";
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
    return 'This phone number is already registered for this event. Use "I already registered" below with your phone number and PIN.';
  }
  if (text.length > 0 && text.length < 160 && !text.includes("invalid input")) {
    return text;
  }
  return "Something went wrong. Please try again, or ask the A1 Kitchen team at the event.";
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ---------- QR code drawn on the page ---------- */

function qrSvg(text) {
  const qr = A1Qr.make(text, "M");
  const quiet = 4;
  const size = qr.size + quiet * 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR code for your food ticket");
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

/* ---------- Register or log in ---------- */

function registerView(eventCode, event) {
  joinView.textContent = "";
  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, event.title));
  line(card, "Host:", event.host_name);
  line(card, "Date:", longDate(event.event_date));
  line(card, "Place:", event.location);
  if (event.meals && event.meals.length > 0) {
    card.appendChild(
      el("p", null, "Your food tickets: " + event.meals.join(" and ") + "."),
    );
  }
  joinView.appendChild(card);

  if (!event.registration_open) {
    joinView.appendChild(
      el(
        "p",
        "menu-notice",
        "Registration for this event is closed or full. Please speak to the A1 Kitchen team at the event.",
      ),
    );
  } else {
    const form = el("div", "card order-card");
    form.appendChild(el("h3", null, "Register for your food ticket"));
    form.appendChild(
      el(
        "p",
        null,
        event.approval_mode === "auto"
          ? "Fill in your details and your food tickets will appear straight away."
          : "Fill in your details. A1 Kitchen will check your registration, usually within seconds, and your food tickets will appear on this page.",
      ),
    );
    const name = el("input");
    name.id = "guest-name";
    name.type = "text";
    name.maxLength = 100;
    name.autocomplete = "name";
    const nameLabel = el("label", null, "Full name *");
    nameLabel.htmlFor = name.id;
    const phone = el("input");
    phone.id = "guest-phone";
    phone.type = "tel";
    phone.maxLength = 20;
    phone.autocomplete = "tel";
    phone.inputMode = "tel";
    const phoneLabel = el("label", null, "Phone number *");
    phoneLabel.htmlFor = phone.id;
    const pin = el("input");
    pin.id = "guest-pin";
    pin.type = "password";
    pin.maxLength = 4;
    pin.inputMode = "numeric";
    pin.autocomplete = "new-password";
    const pinLabel = el("label", null, "Choose a 4-digit PIN *");
    pinLabel.htmlFor = pin.id;
    const pinHelp = el(
      "p",
      "field-help",
      "You will use your phone number and this PIN to find your tickets again. Do not use your mobile money PIN.",
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
      if (!/^\d{4}$/.test(pin.value)) {
        message.textContent = "Please choose a PIN made of exactly 4 numbers.";
        pin.focus();
        return;
      }
      busy = true;
      submit.disabled = true;
      message.textContent = "Registering...";
      try {
        const result = await callRpc("register_catering_guest", {
          p_join_code: eventCode,
          p_full_name: name.value.trim(),
          p_phone: phone.value.trim(),
          p_pin: pin.value,
        });
        localStorage.setItem(GUEST_KEY, result.access_code);
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
      pinLabel,
      pin,
      pinHelp,
      submit,
      message,
    );
    joinView.appendChild(form);
  }

  // Already registered
  const login = el("div", "card order-card");
  login.appendChild(el("h3", null, "I already registered"));
  const lphone = el("input");
  lphone.id = "login-phone";
  lphone.type = "tel";
  lphone.maxLength = 20;
  lphone.autocomplete = "tel";
  lphone.inputMode = "tel";
  const lphoneLabel = el("label", null, "Phone number");
  lphoneLabel.htmlFor = lphone.id;
  const lpin = el("input");
  lpin.id = "login-pin";
  lpin.type = "password";
  lpin.maxLength = 4;
  lpin.inputMode = "numeric";
  lpin.autocomplete = "current-password";
  const lpinLabel = el("label", null, "Your 4-digit PIN");
  lpinLabel.htmlFor = lpin.id;
  const lmessage = el("p", "success-message");
  lmessage.setAttribute("role", "status");
  lmessage.setAttribute("aria-live", "polite");
  const lbutton = el("button", "button button-secondary", "Find my tickets");
  lbutton.type = "button";
  lbutton.addEventListener("click", async () => {
    if (!isValidPhone(lphone.value.trim()) || !/^\d{4}$/.test(lpin.value)) {
      lmessage.textContent =
        "Please enter your phone number and your 4-digit PIN.";
      return;
    }
    lbutton.disabled = true;
    lmessage.textContent = "Checking...";
    try {
      const result = await callRpc("catering_guest_login", {
        p_join_code: eventCode,
        p_phone: lphone.value.trim(),
        p_pin: lpin.value,
      });
      if (result && result.ok) {
        localStorage.setItem(GUEST_KEY, result.access_code);
        window.location.hash = "#g=" + result.access_code;
        return;
      }
      lmessage.textContent =
        (result && result.message) || "We could not find that registration.";
    } catch (error) {
      lmessage.textContent = friendlyError(error);
    }
    lbutton.disabled = false;
  });
  login.append(lphoneLabel, lphone, lpinLabel, lpin, lbutton, lmessage);
  joinView.appendChild(login);
}

async function showEvent(eventCode) {
  say("Loading...");
  try {
    const event = await callRpc("get_catering_event", {
      p_join_code: eventCode,
    });
    say("");
    registerView(eventCode, event);
  } catch (error) {
    console.error("Event error:", error);
    say(
      "We could not find this event. Please scan the QR code again, or ask the A1 Kitchen team.",
    );
  }
}

/* ---------- The guest's own page ---------- */

function ticketsFor(guest) {
  return (guest.tickets || []).map((ticket) => ({
    kind: "food",
    ticketNumber: ticket.ticket_number,
    mealName: ticket.meal,
    eventTitle: guest.event.title,
    eventDate: guest.event.event_date,
    startTime: "",
    location: guest.event.location,
    holder: guest.full_name,
    regNumber: "",
    approvedAt: new Date().toISOString(),
    amount: 0,
    items: [],
    contact: typeof SITE_INFO !== "undefined" ? SITE_INFO.phone : "",
    verifyUrl: window.location.origin + "/gate.html#t=" + ticket.ticket_number,
  }));
}

async function downloadPdf(button, tickets, fileName) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing...";
  try {
    await A1TicketPdf.download(tickets, fileName);
  } catch (error) {
    console.error("PDF error:", error);
    say(
      "We could not prepare the PDF. Please take a screenshot of your QR code instead.",
    );
  }
  button.textContent = original;
  button.disabled = false;
}

function guestView(guest) {
  joinView.textContent = "";
  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, "Hello, " + guest.full_name));
  card.appendChild(el("h3", null, guest.event.title));
  line(card, "Host:", guest.event.host_name);
  line(card, "Date:", longDate(guest.event.event_date));
  line(card, "Place:", guest.event.location);
  joinView.appendChild(card);

  if (guest.status === "Pending") {
    joinView.appendChild(
      el(
        "p",
        "menu-notice",
        "Thank you. A1 Kitchen is checking your registration. Please keep this page open. It updates by itself as soon as you are approved.",
      ),
    );
    return;
  }
  if (guest.status === "Rejected") {
    joinView.appendChild(
      el(
        "p",
        "duplicate-warning",
        "Your registration could not be approved" +
          (guest.reject_reason ? ": " + guest.reject_reason : ".") +
          " Please speak to the A1 Kitchen team or the host.",
      ),
    );
    return;
  }

  joinView.appendChild(
    el(
      "p",
      "success-message",
      "You are approved. Show your QR code at the serving area for each meal.",
    ),
  );
  const tickets = ticketsFor(guest);
  tickets.forEach((ticket, index) => {
    const source = guest.tickets[index];
    const box = el("div", "card order-card");
    box.appendChild(el("h3", null, source.meal));
    const used = source.status === "Used";
    const badges = el("p");
    badges.appendChild(
      el(
        "span",
        "badge " + (used ? "badge-bad" : "badge-good"),
        used ? "Already served" : "Ready to use",
      ),
    );
    box.appendChild(badges);
    line(box, "Ticket number:", source.ticket_number);
    line(box, "Serving:", "1 meal");
    if (!used) {
      box.appendChild(qrSvg(ticket.verifyUrl));
      const button = el(
        "button",
        "button button-secondary",
        "Download this ticket (PDF)",
      );
      button.type = "button";
      button.addEventListener("click", () =>
        downloadPdf(
          button,
          [ticket],
          "A1-Kitchen-food-ticket-" + source.ticket_number + ".pdf",
        ),
      );
      box.appendChild(button);
    }
    joinView.appendChild(box);
  });
  const open = tickets.filter(
    (ticket, index) => guest.tickets[index].status !== "Used",
  );
  if (open.length > 1) {
    const all = el("button", "button", "Download all tickets (PDF)");
    all.type = "button";
    all.addEventListener("click", () =>
      downloadPdf(all, open, "A1-Kitchen-food-tickets.pdf"),
    );
    joinView.appendChild(all);
  }
  joinView.appendChild(
    el(
      "p",
      "field-help",
      "Tip: take a screenshot of your QR codes in case your phone has no internet at the serving area.",
    ),
  );
}

async function loadGuest(code, quiet) {
  if (!quiet) {
    say("Loading...");
  }
  try {
    const guest = await callRpc("get_catering_guest", { p_access_code: code });
    say("");
    guestView(guest);
    if (guest.status === "Pending") {
      if (!pollTimer) {
        pollTimer = setInterval(() => loadGuest(code, true), 6000);
      }
    } else {
      stopPolling();
    }
  } catch (error) {
    console.error("Guest error:", error);
    stopPolling();
    if ((error.message || "").includes("not found")) {
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch (storageError) {
        /* ignore */
      }
      say(
        "We could not find that registration. Please scan the event QR code again.",
      );
      joinView.textContent = "";
    } else if (!quiet) {
      say(
        "We could not load your page. Please check your internet connection and try again.",
      );
    }
  }
}

/* ---------- Start ---------- */

function route() {
  stopPolling();
  joinView.textContent = "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const eventCode = (params.get("e") || "").trim().toLowerCase();
  const guestCode = (params.get("g") || "").trim().toLowerCase();
  if (TOKEN_PATTERN.test(guestCode)) {
    currentGuestCode = guestCode;
    loadGuest(guestCode, false);
    return;
  }
  if (TOKEN_PATTERN.test(eventCode)) {
    showEvent(eventCode);
    return;
  }
  let saved = "";
  try {
    saved = (localStorage.getItem(GUEST_KEY) || "").toLowerCase();
  } catch (error) {
    saved = "";
  }
  if (TOKEN_PATTERN.test(saved)) {
    window.location.hash = "#g=" + saved;
    return;
  }
  say(
    "Please scan the event's QR code with your phone camera to register for your food ticket.",
  );
}

window.addEventListener("hashchange", route);
route();
