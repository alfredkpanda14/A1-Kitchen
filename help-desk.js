/* A1 Kitchen: Customer Help Desk (Developer, Head Chef, Manager)
   Staff never ask for or see an old PIN. Links and new PINs go only to the
   phone number already on the customer's record. */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const form = document.getElementById("help-form");
const termInput = document.getElementById("help-term");
const goButton = document.getElementById("help-go");
const results = document.getElementById("help-results");
const signOutButton = document.getElementById("signout-button");

let staff = null;

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
  dashMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function goTo(page) {
  window.location.href = page;
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  if (text.length > 0 && text.length < 200) {
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

function shortDate(dateText) {
  const date = new Date(String(dateText || "").slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* Sierra Leone numbers: 0XX XXX XXX becomes 232XXXXXXXX for WhatsApp */
function whatsappNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("232")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return "232" + digits.slice(1);
  }
  if (digits.length === 8) {
    return "232" + digits;
  }
  return digits;
}

function openWhatsApp(phone, message) {
  const url =
    "https://wa.me/" +
    whatsappNumber(phone) +
    "?text=" +
    encodeURIComponent(message);
  window.open(url, "_blank", "noopener");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    return false;
  }
}

function firstName(fullName) {
  return (
    String(fullName || "")
      .trim()
      .split(/\s+/)[0] || "there"
  );
}

function badge(text, kind) {
  return el("span", "badge " + (kind || ""), text);
}

function statusKind(status) {
  const value = String(status || "").toLowerCase();
  if (/approved|active|paid|valid/.test(value)) {
    return "badge-good";
  }
  if (/reject|cancel|void/.test(value)) {
    return "badge-bad";
  }
  return "badge-warn";
}

function card(title, phone) {
  const box = el("article", "help-card");
  const top = el("div", "help-card-top");
  top.appendChild(el("h3", null, title));
  top.appendChild(el("p", "help-phone", "Phone on record: " + phone));
  box.appendChild(top);
  return box;
}

/* A short message shown right on the customer's card */
function note(box, text) {
  let line = box.querySelector(".help-note");
  if (!line) {
    line = el("p", "help-note");
    line.setAttribute("role", "status");
    box.appendChild(line);
  }
  line.textContent = text;
  say(text);
}

function buttonRow() {
  return el("div", "help-buttons");
}

function button(text, secondary) {
  const node = el(
    "button",
    secondary ? "button button-secondary" : "button",
    text,
  );
  node.type = "button";
  return node;
}

/* ---------- Sending private links ---------- */

const LINK_WORDS = {
  event: "your private A1 Kitchen page for your event tickets and payments",
  competition:
    "your private A1 Kitchen competition page (ticket, status and results)",
};

async function getLink(kind, id, buttons) {
  buttons.forEach((item) => {
    item.disabled = true;
  });
  try {
    const info = await rpc("staff_help_link", { p_kind: kind, p_id: id });
    return {
      name: info.full_name,
      phone: info.phone,
      url: window.location.origin + "/" + info.path,
    };
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}

function linkButtons(kind, record, box) {
  const row = buttonRow();
  const send = button("Send link on WhatsApp");
  const copy = button("Copy link", true);
  const all = [send, copy];
  send.addEventListener("click", async () => {
    try {
      const link = await getLink(kind, record.id, all);
      openWhatsApp(
        link.phone,
        "Hello " +
          firstName(link.name) +
          ", this is A1 Kitchen. Here is " +
          LINK_WORDS[kind] +
          ":\n" +
          link.url +
          "\nPlease keep this link to yourself. Thank you!",
      );
      note(
        box,
        "WhatsApp opened with the link for " +
          link.name +
          ", to " +
          link.phone +
          ". Press send in WhatsApp.",
      );
    } catch (error) {
      note(box, friendlyError(error));
    }
  });
  copy.addEventListener("click", async () => {
    try {
      const link = await getLink(kind, record.id, all);
      const copied = await copyText(link.url);
      note(
        box,
        copied
          ? "Link copied for " +
              link.name +
              ". Send it only to " +
              link.phone +
              "."
          : "Could not copy on this device. Please use the WhatsApp button.",
      );
    } catch (error) {
      note(box, friendlyError(error));
    }
  });
  row.append(send, copy);
  return row;
}

/* ---------- Catering guests: unlock or new PIN ---------- */

function showNewPin(box, result) {
  const panel = el("div", "help-pin");
  panel.appendChild(
    el("p", "help-pin-label", "New PIN for " + result.full_name),
  );
  panel.appendChild(el("p", "help-pin-number", result.pin));
  panel.appendChild(
    el(
      "p",
      "field-help",
      "This PIN is shown only once. The old PIN no longer works. Send it to the phone on record only.",
    ),
  );
  const row = buttonRow();
  const send = button("Send PIN on WhatsApp");
  send.addEventListener("click", () => {
    openWhatsApp(
      result.phone,
      "Hello " +
        firstName(result.full_name) +
        ", this is A1 Kitchen. Your new 4-digit PIN for " +
        (result.event_title || "your invitation") +
        " is: " +
        result.pin +
        "\nOpen your invitation link and log in with your phone number and this PIN. Please do not share your PIN with anyone.",
    );
    note(
      box,
      "WhatsApp opened with the new PIN for " +
        result.full_name +
        ". Press send in WhatsApp.",
    );
  });
  const hide = button("Hide PIN", true);
  hide.addEventListener("click", () => panel.remove());
  row.append(send, hide);
  panel.appendChild(row);
  box.appendChild(panel);
}

function guestButtons(record, box) {
  const row = buttonRow();
  if (record.status === "Rejected") {
    row.appendChild(
      el(
        "p",
        "field-help",
        "This guest was not approved, so no PIN help is needed.",
      ),
    );
    return row;
  }
  if (record.locked) {
    const unlock = button("Unlock (keep the same PIN)", true);
    unlock.classList.add("help-unlock");
    unlock.addEventListener("click", async () => {
      unlock.disabled = true;
      try {
        await rpc("staff_help_unlock", { p_guest_id: record.id });
        note(
          box,
          record.full_name + " is unlocked and can try their PIN again now.",
        );
        unlock.remove();
        const lockBadge = box.querySelector(".help-locked");
        if (lockBadge) {
          lockBadge.remove();
        }
      } catch (error) {
        unlock.disabled = false;
        note(box, friendlyError(error));
      }
    });
    row.appendChild(unlock);
  }
  const newPin = button("Give a new PIN");
  newPin.addEventListener("click", () => {
    if (box.querySelector(".help-confirm, .help-pin")) {
      return;
    }
    const confirmBox = el("div", "help-confirm");
    confirmBox.appendChild(
      el(
        "p",
        null,
        "Give " +
          record.full_name +
          " a new PIN? Their old PIN will stop working. Only do this if they forgot it.",
      ),
    );
    const yes = button("Yes, make a new PIN");
    const no = button("Cancel", true);
    no.addEventListener("click", () => confirmBox.remove());
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      no.disabled = true;
      try {
        const result = await rpc("staff_help_new_pin", {
          p_guest_id: record.id,
        });
        confirmBox.remove();
        box
          .querySelectorAll(".help-locked, .help-unlock")
          .forEach((node) => node.remove());
        showNewPin(box, result);
        say("New PIN made for " + result.full_name + ".");
      } catch (error) {
        yes.disabled = false;
        no.disabled = false;
        note(box, friendlyError(error));
      }
    });
    const confirmRow = buttonRow();
    confirmRow.append(yes, no);
    confirmBox.appendChild(confirmRow);
    box.appendChild(confirmBox);
  });
  row.appendChild(newPin);
  return row;
}

/* ---------- Results ---------- */

function group(title, count) {
  const section = el("section", "help-group");
  section.appendChild(el("h3", "special-group", title + " (" + count + ")"));
  return section;
}

function drawResults(data) {
  results.textContent = "";
  const events = data.events || [];
  const competitions = data.competitions || [];
  const catering = data.catering || [];
  if (events.length + competitions.length + catering.length === 0) {
    results.appendChild(
      el(
        "p",
        "guide-empty",
        "No customer found. Check the spelling, or try the phone number instead.",
      ),
    );
    return;
  }

  if (events.length > 0) {
    const section = group("Event tickets", events.length);
    events.forEach((record) => {
      const box = card(record.full_name, record.phone);
      const list = el("ul", "help-list");
      (record.registrations || []).forEach((reg) => {
        const item = el("li");
        item.appendChild(
          el(
            "span",
            null,
            [reg.event_title, shortDate(reg.event_date), reg.reg_number]
              .filter(Boolean)
              .join(" · ") + " ",
          ),
        );
        if (reg.payment_status) {
          item.appendChild(
            badge(reg.payment_status, statusKind(reg.payment_status)),
          );
        }
        list.appendChild(item);
      });
      if (list.children.length > 0) {
        box.appendChild(list);
      }
      box.appendChild(linkButtons("event", record, box));
      section.appendChild(box);
    });
    results.appendChild(section);
  }

  if (competitions.length > 0) {
    const section = group("Competitions", competitions.length);
    competitions.forEach((record) => {
      const box = card(record.full_name, record.phone);
      const line = el(
        "p",
        "help-detail",
        [
          record.competition_title,
          shortDate(record.event_date),
          record.ticket_number,
        ]
          .filter(Boolean)
          .join(" · ") + " ",
      );
      line.appendChild(badge(record.status, statusKind(record.status)));
      box.appendChild(line);
      box.appendChild(linkButtons("competition", record, box));
      section.appendChild(box);
    });
    results.appendChild(section);
  }

  if (catering.length > 0) {
    const section = group("Catering guests", catering.length);
    catering.forEach((record) => {
      const box = card(record.full_name, record.phone);
      const line = el(
        "p",
        "help-detail",
        [record.event_title, shortDate(record.event_date)]
          .filter(Boolean)
          .join(" · ") + " ",
      );
      line.appendChild(badge(record.status, statusKind(record.status)));
      if (record.locked) {
        line.appendChild(
          el("span", "badge badge-bad help-locked", "Locked after wrong PINs"),
        );
      }
      box.appendChild(line);
      box.appendChild(guestButtons(record, box));
      section.appendChild(box);
    });
    results.appendChild(section);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const term = termInput.value.trim();
  if (term.length < 3) {
    say("Please type at least 3 letters of the name, or the phone number.");
    termInput.focus();
    return;
  }
  goButton.disabled = true;
  say("Searching...");
  try {
    const data = await rpc("staff_help_search", { p_term: term });
    drawResults(data || {});
    say("");
  } catch (error) {
    say(friendlyError(error));
  } finally {
    goButton.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

async function start() {
  const { data: session } = await supabaseClient.auth.getSession();
  if (!session || !session.session) {
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
  if (!can("help.tools")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  document.getElementById("nav-events").hidden = !can("events.view");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    String(staff.role || "").replace(/_/g, " ") +
    ")";
  termInput.focus();
}

start();
