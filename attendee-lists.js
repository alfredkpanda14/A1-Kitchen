/* A1 Kitchen: download the attendee list of an event (staff who see events) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const eventList = document.getElementById("event-list");
const signOutButton = document.getElementById("signout-button");

let staff = null;

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

function longDate(text) {
  const date = new Date(String(text || "").slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function stamp(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* One spreadsheet cell. Text that starts with = + - @ is made safe so a
   spreadsheet never treats it as a formula. */
function cell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}

const COLUMNS = [
  ["Registration number", (r) => r.reg_number],
  ["Name", (r) => r.full_name],
  ["Phone", (r) => r.phone],
  ["People", (r) => r.people],
  ["Tickets", (r) => r.tickets],
  ["Total (NLe)", (r) => r.total],
  ["Paid (NLe)", (r) => r.paid],
  ["Balance (NLe)", (r) => r.balance],
  ["Payment status", (r) => r.payment_status],
  ["Registration status", (r) => r.status],
  ["Registered on", (r) => stamp(r.registered_at)],
  ["Came in at the gate", (r) => stamp(r.entered_at)],
  ["People admitted", (r) => r.admitted],
  ["Notes", (r) => r.notes],
];

function toCsv(rows) {
  const lines = [COLUMNS.map(([name]) => cell(name)).join(",")];
  rows.forEach((row) => {
    lines.push(COLUMNS.map(([, read]) => cell(read(row))).join(","));
  });
  const people = rows.reduce((sum, row) => sum + Number(row.people || 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const balance = rows.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  lines.push("");
  lines.push(
    [
      cell("TOTAL"),
      cell(rows.length + " registrations"),
      cell(""),
      cell(people),
      cell(""),
      cell(""),
      cell(paid),
      cell(balance),
    ].join(","),
  );
  /* The mark at the start helps Excel show names with accents correctly */
  return "﻿" + lines.join("\r\n");
}

function saveFile(text, fileName) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function download(item, button) {
  button.disabled = true;
  say("Preparing the list...");
  try {
    const result = await rpc("staff_event_attendees", {
      p_event_id: item.id || null,
      p_year: item.id ? null : item.year,
    });
    const rows = result.rows || [];
    const safeTitle = String(result.title || "Event")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    saveFile(
      toCsv(rows),
      "A1-Attendees-" +
        safeTitle +
        "-" +
        String(item.event_date || "").slice(0, 4) +
        ".csv",
    );
    say(
      "Downloaded " +
        rows.length +
        (rows.length === 1 ? " registration" : " registrations") +
        " for " +
        result.title +
        ".",
    );
  } catch (error) {
    say(friendlyError(error));
  }
  button.disabled = false;
}

async function load() {
  const items = (await rpc("staff_attendee_events")) || [];
  eventList.textContent = "";
  if (items.length === 0) {
    eventList.appendChild(el("p", "guide-empty", "There are no events yet."));
    return;
  }
  items.forEach((item) => {
    const row = el("article", "attendee-row");
    const info = el("div");
    info.appendChild(el("h3", null, item.title));
    info.appendChild(
      el(
        "p",
        "field-help",
        [
          longDate(item.event_date),
          item.registrations + " registrations",
          item.people + " people",
        ]
          .filter(Boolean)
          .join("  ·  "),
      ),
    );
    const button = el("button", "button", "Download list");
    button.type = "button";
    button.disabled = Number(item.registrations) === 0;
    button.addEventListener("click", () => download(item, button));
    row.append(info, button);
    eventList.appendChild(row);
  });
}

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
  if (!can("events.view")) {
    goTo("chef-dashboard.html");
    return;
  }
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    String(staff.role || "").replace(/_/g, " ") +
    ")";
  try {
    await load();
  } catch (error) {
    say(friendlyError(error));
  }
}

start();
