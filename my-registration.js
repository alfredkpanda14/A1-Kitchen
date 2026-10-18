/* A1 Kitchen: "My Event Dashboard" (one page for all of a person's tickets) */
const regMessage = document.getElementById("reg-message");
const regResult = document.getElementById("reg-result");
const regLookup = document.getElementById("reg-lookup");
const regLookupForm = document.getElementById("reg-lookup-form");

const REG_PATTERN = /^E-\d{4}-[A-Z0-9]{6}$/;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER_KEY = "a1KitchenEventCustomer";
const OLD_REG_KEY = "a1KitchenEventReg";
const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;
const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let dashboardCode = "";

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

function shortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function plainTitle(title) {
  return String(title || "")
    .replace(/\s*\b20\d{2}\b/g, "")
    .trim();
}

function nextYear(dateText) {
  const date = new Date(dateText + "T00:00:00");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  date.setFullYear(date.getFullYear() + 1);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addLine(parent, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
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
  if (text.length > 0 && text.length < 160 && !text.includes("invalid input")) {
    return text;
  }
  return "Something went wrong. Please try again, or contact A1 Kitchen.";
}

function dashboardLink() {
  return (
    window.location.origin +
    window.location.pathname +
    "#c=" +
    encodeURIComponent(dashboardCode)
  );
}

async function fileHash(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function info(key) {
  return typeof SITE_INFO !== "undefined" && SITE_INFO[key]
    ? SITE_INFO[key]
    : "";
}

/* ---------- Tickets (PDF) ---------- */

function ticketsFor(data, registration) {
  const event = registration.event || {};
  return (registration.payments || [])
    .filter((payment) => payment.status === "Verified" && payment.ticket_number)
    .sort((a, b) => a.ticket_no - b.ticket_no)
    .map((payment) => ({
      kind: payment.ticket_no === 1 ? "main" : "balance",
      ticketNumber: payment.ticket_number,
      firstTicketNumber: registration.first_ticket_number,
      eventTitle: event.title,
      eventDate: event.event_date,
      startTime: event.start_time,
      location: event.location,
      holder: data.full_name,
      regNumber: registration.reg_number,
      approvedAt: payment.reviewed_at,
      amount: payment.amount,
      method: payment.method,
      items: registration.items,
      contact: info("phone"),
    }));
}

async function downloadTickets(button, tickets, fileName) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing...";
  try {
    await A1TicketPdf.download(tickets, fileName);
  } catch (error) {
    console.error("Ticket PDF error:", error);
    regMessage.textContent =
      "We could not prepare the ticket. Please try again, or contact A1 Kitchen.";
  }
  button.textContent = original;
  button.disabled = false;
}

/* ---------- Payment form ---------- */

function paymentDetails(method) {
  if (method === "Orange Money") {
    const number = info("orangeMoneyNumber");
    const name = info("orangeMoneyName");
    return number
      ? "Send the money to Orange Money number " +
          number +
          (name ? " (name: " + name + ")" : "") +
          "."
      : "The Orange Money number will be added soon. Please contact A1 Kitchen.";
  }
  const number = info("afrimoneyNumber");
  const name = info("afrimoneyName");
  return number
    ? "Send the money to AfriMoney number " +
        number +
        (name ? " (name: " + name + ")" : "") +
        "."
    : "The AfriMoney number will be added soon. Please use Orange Money, or contact A1 Kitchen.";
}

function paymentForm(registration) {
  const box = el("div", "photo-box");
  box.appendChild(el("h4", null, "Pay " + money(registration.balance)));
  const id = "pay-" + registration.reg_number;

  const methodSelect = el("select");
  methodSelect.id = id + "-method";
  ["Orange Money", "AfriMoney"].forEach((name) => {
    const option = el("option", null, name);
    option.value = name;
    methodSelect.appendChild(option);
  });
  const methodLabel = el("label", null, "How did you pay?");
  methodLabel.htmlFor = methodSelect.id;

  const details = el("p", "menu-notice", paymentDetails("Orange Money"));
  methodSelect.addEventListener("change", () => {
    details.textContent = paymentDetails(methodSelect.value);
  });

  const amountInput = el("input");
  amountInput.id = id + "-amount";
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.max = String(registration.balance);
  amountInput.step = "0.01";
  amountInput.inputMode = "decimal";
  amountInput.value = String(registration.balance);
  const amountLabel = el("label", null, "Amount you sent (NLe)");
  amountLabel.htmlFor = amountInput.id;

  const refInput = el("input");
  refInput.id = id + "-ref";
  refInput.type = "text";
  refInput.maxLength = 60;
  refInput.autocomplete = "off";
  const refLabel = el(
    "label",
    null,
    "Transaction ID (if your phone shows one)",
  );
  refLabel.htmlFor = refInput.id;

  const fileInput = el("input");
  fileInput.id = id + "-file";
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  const fileLabel = el(
    "label",
    null,
    "Screenshot of your payment * (JPG, PNG or WebP, up to 6 MB)",
  );
  fileLabel.htmlFor = fileInput.id;

  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  const submit = el("button", "button", "Send my payment for checking");
  submit.type = "button";
  let busy = false;

  submit.addEventListener("click", async () => {
    if (busy) {
      return;
    }
    const amount = Number(amountInput.value);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > registration.balance
    ) {
      message.textContent =
        "Please enter an amount up to " + money(registration.balance) + ".";
      amountInput.focus();
      return;
    }
    const file = fileInput.files[0];
    if (!file) {
      message.textContent = "Please choose your payment screenshot.";
      fileInput.focus();
      return;
    }
    const extension = EXTENSION_BY_TYPE[file.type];
    if (!extension) {
      message.textContent = "Please upload a JPG, PNG or WebP image.";
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      message.textContent =
        "The screenshot is too large. Please use an image below 6 MB.";
      return;
    }
    if (!supabaseClient) {
      message.textContent =
        "The page could not start the upload. Please refresh and try again.";
      return;
    }
    busy = true;
    submit.disabled = true;
    message.textContent = "Uploading your screenshot...";
    const path =
      dashboardCode +
      "/" +
      registration.reg_number +
      "/" +
      crypto.randomUUID() +
      "." +
      extension;
    try {
      const upload = await supabaseClient.storage
        .from("event-payment-proof")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upload.error) {
        throw new Error(
          "The screenshot could not be uploaded. Please try again.",
        );
      }
      await callRpc("submit_event_payment", {
        p_customer_code: dashboardCode,
        p_reg_number: registration.reg_number,
        p_method: methodSelect.value,
        p_amount: amount,
        p_reference: refInput.value.trim() || null,
        p_screenshot_path: path,
        p_file_hash: await fileHash(file),
      });
      await load(
        dashboardCode,
        "Thank you. Your payment screenshot was received and is being checked. Your ticket will appear here once it is approved.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Payment submit error:", error);
      message.textContent = friendlyError(error);
      busy = false;
      submit.disabled = false;
    }
  });

  box.append(
    el(
      "p",
      null,
      "1. Send the money with Orange Money or AfriMoney. 2. Take a screenshot of the confirmation. 3. Upload it here.",
    ),
    methodLabel,
    methodSelect,
    details,
    amountLabel,
    amountInput,
    refLabel,
    refInput,
    fileLabel,
    fileInput,
    submit,
    message,
    el(
      "p",
      "field-help",
      "Never share your PIN or password with anyone. A1 Kitchen will never ask for it. Only the Head Chef, Manager and Developer can see your screenshot.",
    ),
  );
  return box;
}

/* ---------- Registration card ---------- */

function paymentBadge(registration) {
  const map = {
    Paid: ["badge-good", "Paid"],
    "Under Review": ["badge-warn", "Payment being checked"],
    "Balance Due": ["badge-bad", "Balance to pay"],
    "Awaiting Payment": ["badge-bad", "Awaiting payment"],
  };
  const entry = map[registration.payment_status] || [
    "badge",
    registration.payment_status,
  ];
  return el("span", "badge " + entry[0], entry[1]);
}

function registrationCard(data, registration) {
  const ended = registration.status === "Ended";
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Registration " + registration.reg_number));
  const badges = el("p");
  if (ended) {
    badges.appendChild(el("span", "badge badge-bad", "Registration ended"));
  } else {
    badges.appendChild(paymentBadge(registration));
  }
  card.appendChild(badges);

  const list = el("ul");
  (registration.items || []).forEach((item) => {
    list.appendChild(
      el(
        "li",
        null,
        item.quantity + " × " + item.name + " at " + money(item.unit_price),
      ),
    );
  });
  card.appendChild(list);
  addLine(card, "Total:", money(registration.total));
  addLine(card, "Paid and approved:", money(registration.amount_paid));
  if (!ended && registration.balance > 0) {
    addLine(card, "Balance to pay:", money(registration.balance));
  }

  // Polite price-change / balance notice
  if (
    !ended &&
    registration.balance > 0 &&
    registration.notices &&
    registration.notices.length > 0
  ) {
    const notice = el("div", "alert-banner");
    notice.appendChild(el("span", null, registration.notices[0].message));
    card.appendChild(notice);
    card.appendChild(
      el(
        "p",
        null,
        "Please pay the balance below. Then print both tickets and bring them with you on the event day. Thank you for your understanding.",
      ),
    );
  }

  const payments = registration.payments || [];
  const pending = payments.find((payment) => payment.status === "Pending");
  const lastRejected =
    payments.length > 0 && payments[0].status === "Rejected"
      ? payments[0]
      : null;

  if (pending && !ended) {
    card.appendChild(
      el(
        "p",
        "menu-notice",
        "Your payment of " +
          money(pending.amount) +
          " is being checked. This page will show your ticket once it is approved.",
      ),
    );
  }
  if (lastRejected && !pending && !ended) {
    card.appendChild(
      el(
        "p",
        "duplicate-warning",
        "Your last payment screenshot could not be approved" +
          (lastRejected.reject_reason
            ? ": " + lastRejected.reject_reason
            : ".") +
          " Please send it again below, or contact A1 Kitchen.",
      ),
    );
  }
  if (!pending && !ended && registration.balance > 0) {
    card.appendChild(paymentForm(registration));
  }

  // Tickets
  const tickets = ticketsFor(data, registration);
  if (tickets.length > 0) {
    const box = el("div", "photo-box");
    box.appendChild(el("h4", null, "Your tickets"));
    box.appendChild(
      el(
        "p",
        null,
        "Download and print your ticket, or keep it on your phone. Show it at the gate on the event day.",
      ),
    );
    tickets.forEach((ticket) => {
      const label =
        ticket.kind === "main"
          ? "Download ticket "
          : "Download balance ticket ";
      const button = el("button", "button", label + ticket.ticketNumber);
      button.type = "button";
      button.addEventListener("click", () =>
        downloadTickets(
          button,
          [ticket],
          "A1-Kitchen-ticket-" + ticket.ticketNumber + ".pdf",
        ),
      );
      box.appendChild(button);
    });
    if (tickets.length > 1) {
      const all = el(
        "button",
        "button button-secondary",
        "Download all " + tickets.length + " tickets in one file",
      );
      all.type = "button";
      all.addEventListener("click", () =>
        downloadTickets(
          all,
          tickets,
          "A1-Kitchen-tickets-" + registration.reg_number + ".pdf",
        ),
      );
      box.appendChild(all);
      box.appendChild(
        el("p", "field-help", "Please print and bring all of them."),
      );
    }
    card.appendChild(box);
  }

  // Payment history
  if (payments.length > 0) {
    const box = el("div", "photo-box");
    box.appendChild(el("h4", null, "Payment history"));
    const history = el("ul");
    payments.forEach((payment) => {
      const status =
        payment.status === "Verified"
          ? "approved"
          : payment.status === "Rejected"
            ? "not approved"
            : "being checked";
      history.appendChild(
        el(
          "li",
          null,
          shortDate(payment.created_at) +
            ": " +
            money(payment.amount) +
            " by " +
            payment.method +
            " (" +
            status +
            ")" +
            (payment.ticket_number ? ", ticket " + payment.ticket_number : ""),
        ),
      );
    });
    box.appendChild(history);
    card.appendChild(box);
  }
  return card;
}

/* ---------- Event group ---------- */

function eventCard(data, registrations) {
  const event = registrations[0].event || {};
  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, event.title || "Event"));
  addLine(card, "Date:", longDate(event.event_date));
  addLine(card, "Time:", event.start_time);
  addLine(card, "Where:", event.location);
  if (event.description) {
    card.appendChild(el("p", null, event.description));
  }

  const open =
    event.status === "published" &&
    event.registration_open &&
    event.event_date >= new Date().toISOString().slice(0, 10);
  if (open) {
    const add = el("a", "button button-secondary", "Add more tickets");
    add.href = "events.html#c=" + encodeURIComponent(dashboardCode);
    card.appendChild(add);
  }

  const updates = registrations[0].updates || [];
  if (updates.length > 0) {
    card.appendChild(el("h4", null, "Updates and changes"));
    const list = el("ul");
    updates.forEach((update) => {
      list.appendChild(
        el("li", null, shortDate(update.created_at) + ": " + update.message),
      );
    });
    card.appendChild(list);
  }

  const ended = registrations.every(
    (registration) => registration.status === "Ended",
  );
  if (ended) {
    const first = registrations[0];
    card.appendChild(el("h4", null, "Thank you for taking part"));
    card.appendChild(
      el(
        "p",
        null,
        "Registration for " +
          plainTitle(event.title) +
          " on " +
          longDate(event.event_date) +
          " has ended. Thank you for being part of it.",
      ),
    );
    if (first.next_event) {
      card.appendChild(
        el(
          "p",
          null,
          "We would love to see you again. You can now register for " +
            plainTitle(first.next_event.title) +
            " on " +
            longDate(first.next_event.event_date) +
            ".",
        ),
      );
    } else if (event.repeats_yearly) {
      card.appendChild(
        el(
          "p",
          null,
          "We hold this event every year. Please come back to register for " +
            plainTitle(event.title) +
            " on " +
            nextYear(event.event_date) +
            " when registration opens.",
        ),
      );
    }
    const link = el("a", "button", "See upcoming events");
    link.href = "events.html";
    card.appendChild(link);
  }
  return card;
}

/* ---------- Whole dashboard ---------- */

function summaryCard(data) {
  const active = (data.registrations || []).filter(
    (registration) => registration.status === "Registered",
  );
  const tickets = active.reduce(
    (sum, registration) => sum + Number(registration.tickets),
    0,
  );
  const paid = active.reduce(
    (sum, registration) => sum + Number(registration.amount_paid),
    0,
  );
  const balance = active.reduce(
    (sum, registration) => sum + Number(registration.balance),
    0,
  );

  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, "Hello, " + data.full_name));
  addLine(card, "Registrations:", String(active.length));
  addLine(card, "Tickets:", String(tickets));
  addLine(card, "Paid and approved:", money(paid));
  addLine(card, "Balance to pay:", money(balance));

  const linkBox = el("div", "photo-box");
  linkBox.appendChild(el("h4", null, "Your private link"));
  linkBox.appendChild(
    el(
      "p",
      null,
      "Save this link. It opens this dashboard on any phone or computer.",
    ),
  );
  const input = el("input");
  input.type = "text";
  input.readOnly = true;
  input.id = "private-link";
  input.value = dashboardLink();
  input.setAttribute("aria-label", "Your private dashboard link");
  const copy = el("button", "button button-secondary", "Copy my link");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      copy.textContent = "Copied";
    } catch (error) {
      input.focus();
      input.select();
      copy.textContent = "Press Copy on your keyboard";
    }
  });
  const forget = el(
    "button",
    "button button-secondary",
    "Sign out on this device",
  );
  forget.type = "button";
  forget.addEventListener("click", () => {
    try {
      localStorage.removeItem(CUSTOMER_KEY);
      localStorage.removeItem(OLD_REG_KEY);
    } catch (error) {
      /* ignore */
    }
    window.location.href = "events.html";
  });
  linkBox.append(input, copy, forget);
  card.appendChild(linkBox);
  return card;
}

function render(data) {
  regResult.textContent = "";
  regResult.appendChild(summaryCard(data));

  const registrations = data.registrations || [];
  if (registrations.length === 0) {
    regResult.appendChild(el("p", null, "You have no registrations yet."));
  }

  const groups = [];
  registrations.forEach((registration) => {
    const key = registration.event.id;
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key: key, items: [] };
      groups.push(group);
    }
    group.items.push(registration);
  });

  groups.forEach((group) => {
    regResult.appendChild(eventCard(data, group.items));
    group.items.forEach((registration) => {
      regResult.appendChild(registrationCard(data, registration));
    });
  });

  const more = el("p");
  const link = el("a", "button", "See upcoming events");
  link.href = "events.html#c=" + encodeURIComponent(dashboardCode);
  more.appendChild(link);
  regResult.appendChild(more);

  regLookup.hidden = true;
  regResult.hidden = false;
}

async function load(code, successText) {
  regMessage.textContent = "Loading your dashboard...";
  try {
    const data = await callRpc("get_my_dashboard", { p_code: code });
    dashboardCode = code;
    try {
      localStorage.setItem(CUSTOMER_KEY, code);
    } catch (error) {
      /* ignore */
    }
    regMessage.textContent = successText || "";
    render(data);
  } catch (error) {
    console.error("Dashboard error:", error);
    if ((error.message || "").includes("not found")) {
      regMessage.textContent =
        "We could not find that dashboard. Please check your link, registration number and code.";
      try {
        localStorage.removeItem(CUSTOMER_KEY);
      } catch (storageError) {
        /* ignore */
      }
    } else {
      regMessage.textContent =
        "We could not load your dashboard. Please check your internet connection and try again.";
    }
    regResult.hidden = true;
    regLookup.hidden = false;
  }
}

/* Old links (registration number + code) are turned into the new link */
async function openFromOldLink(regNumber, code) {
  regMessage.textContent = "Loading your dashboard...";
  try {
    const customerCode = await callRpc("resolve_registration_link", {
      p_reg_number: regNumber,
      p_access_code: code,
    });
    history.replaceState(null, "", "#c=" + encodeURIComponent(customerCode));
    await load(customerCode);
  } catch (error) {
    console.error("Old link error:", error);
    regMessage.textContent =
      "We could not find that registration. Please check your link, registration number and code.";
    regResult.hidden = true;
    regLookup.hidden = false;
  }
}

regLookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const regNumber = document
    .getElementById("lookup-reg")
    .value.trim()
    .toUpperCase();
  const code = document
    .getElementById("lookup-code")
    .value.trim()
    .toLowerCase();
  if (!REG_PATTERN.test(regNumber)) {
    regMessage.textContent =
      "Please check your registration number. It looks like E-2026-ABC123.";
    return;
  }
  if (!TOKEN_PATTERN.test(code)) {
    regMessage.textContent = "Please check your code.";
    return;
  }
  openFromOldLink(regNumber, code);
});

function start() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  let savedCustomer = "";
  let savedOld = null;
  try {
    savedCustomer = localStorage.getItem(CUSTOMER_KEY) || "";
    savedOld = JSON.parse(localStorage.getItem(OLD_REG_KEY));
  } catch (error) {
    savedOld = null;
  }

  const customerCode = (params.get("c") || savedCustomer || "")
    .trim()
    .toLowerCase();
  if (TOKEN_PATTERN.test(customerCode)) {
    load(customerCode);
    return;
  }

  const regNumber = (
    params.get("r") ||
    (savedOld && savedOld.reg_number) ||
    ""
  ).trim();
  const code = (params.get("t") || (savedOld && savedOld.access_code) || "")
    .trim()
    .toLowerCase();
  if (REG_PATTERN.test(regNumber) && TOKEN_PATTERN.test(code)) {
    openFromOldLink(regNumber, code);
    return;
  }
  regLookup.hidden = false;
}

start();
