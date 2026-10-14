const regMessage = document.getElementById("reg-message");
const regResult = document.getElementById("reg-result");
const regLookup = document.getElementById("reg-lookup");
const regLookupForm = document.getElementById("reg-lookup-form");

const REG_PATTERN = /^E-\d{4}-[A-Z0-9]{6}$/;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/* Removes a year from an event name, so "Outing 2026" reads well next year */
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

function addLine(parent, label, value) {
  if (!value) {
    return;
  }

  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function render(data) {
  regResult.textContent = "";
  const event = data.event || {};
  const ended = data.status === "Ended";
  const cancelled = data.status === "Cancelled";

  const card = el("div", "card order-card");
  card.appendChild(el("h2", null, event.title || "Your registration"));

  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " + (ended || cancelled ? "badge-bad" : "badge-good"),
      ended ? "Registration ended" : cancelled ? "Cancelled" : "Registered",
    ),
  );
  card.appendChild(badges);

  addLine(card, "Registration number:", data.reg_number);
  addLine(card, "Name:", data.full_name);
  addLine(card, "Date:", longDate(event.event_date));
  addLine(card, "Time:", event.start_time);
  addLine(card, "Where:", event.location);

  if (event.description) {
    card.appendChild(el("p", null, event.description));
  }

  regResult.appendChild(card);

  if (ended) {
    const thanks = el("div", "card order-card");
    thanks.appendChild(el("h3", null, "Thank you for taking part"));
    thanks.appendChild(
      el(
        "p",
        null,
        "Your registration for " +
          plainTitle(event.title) +
          " on " +
          longDate(event.event_date) +
          " has ended. Thank you for being part of it.",
      ),
    );

    if (data.next_event) {
      thanks.appendChild(
        el(
          "p",
          null,
          "We would love to see you again. You can now register for " +
            plainTitle(data.next_event.title) +
            " on " +
            longDate(data.next_event.event_date) +
            ".",
        ),
      );
    } else if (event.repeats_yearly) {
      thanks.appendChild(
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
    thanks.appendChild(link);
    regResult.appendChild(thanks);
  }

  const tickets = el("div", "card order-card");
  tickets.appendChild(el("h3", null, "Your tickets"));
  const list = el("ul");
  let priceChanged = false;

  (data.items || []).forEach((item) => {
    let text =
      item.quantity + " × " + item.name + " at " + money(item.unit_price);

    if (
      item.current_price !== null &&
      item.current_price !== undefined &&
      Number(item.current_price) !== Number(item.unit_price)
    ) {
      text += " (price is now " + money(item.current_price) + ")";
      priceChanged = true;
    }

    list.appendChild(el("li", null, text));
  });

  tickets.appendChild(list);
  addLine(tickets, "Total when you registered:", money(data.total));

  if (priceChanged && !ended) {
    tickets.appendChild(
      el(
        "p",
        "menu-notice",
        "A ticket price has changed since you registered. A1 Kitchen will contact you about any difference.",
      ),
    );
  }

  if (!ended && !cancelled) {
    tickets.appendChild(
      el(
        "p",
        null,
        "A1 Kitchen will contact you about payment and any other details.",
      ),
    );
  }

  regResult.appendChild(tickets);

  if (data.updates && data.updates.length > 0) {
    const updates = el("div", "card order-card");
    updates.appendChild(el("h3", null, "Updates and changes"));
    const updateList = el("ul");

    data.updates.forEach((update) => {
      const date = new Date(update.created_at);
      const when = Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
          ": ";
      updateList.appendChild(el("li", null, when + update.message));
    });

    updates.appendChild(updateList);
    regResult.appendChild(updates);
  }

  regLookup.hidden = true;
  regResult.hidden = false;
}

async function load(regNumber, code) {
  regMessage.textContent = "Loading your registration...";

  try {
    const data = await callRpc("get_my_registration", {
      p_reg_number: regNumber,
      p_access_code: code,
    });

    regMessage.textContent = "";
    render(data);
  } catch (error) {
    console.error("Registration lookup error:", error);

    if ((error.message || "").includes("not found")) {
      regMessage.textContent =
        "We could not find that registration. Please check your link, registration number and code.";
    } else {
      regMessage.textContent =
        "We could not load your registration. Please check your internet connection and try again.";
    }

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

  load(regNumber, code);
});

function start() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  let saved = null;

  try {
    saved = JSON.parse(localStorage.getItem("a1KitchenEventReg"));
  } catch (error) {
    saved = null;
  }

  const regNumber = (
    params.get("r") ||
    (saved && saved.reg_number) ||
    ""
  ).trim();
  const code = (params.get("t") || (saved && saved.access_code) || "").trim();

  if (REG_PATTERN.test(regNumber) && TOKEN_PATTERN.test(code)) {
    load(regNumber, code);
  } else {
    regLookup.hidden = false;
  }
}

start();
