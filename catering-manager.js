/* A1 Kitchen: Catering events manager (guest QR registration, approvals, meal tickets) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const newBox = document.getElementById("new-box");
const pendingBox = document.getElementById("pending-box");
const eventList = document.getElementById("event-list");

const PRESET_MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const BASE_TITLE = "A1 Kitchen | Catering Events";

let staff = null;
let events = [];
let pending = [];
const openGuests = {}; // event id -> { filter, search, guests }

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

function timeAgo(value) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return Math.round(seconds / 60) + " min ago";
  }
  if (seconds < 86400) {
    return Math.round(seconds / 3600) + " h ago";
  }
  return Math.round(seconds / 86400) + " days ago";
}

function friendlyError(error) {
  const text = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }
  if (text.length > 0 && text.length < 180) {
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

function textInput(id, value, maxLength) {
  const input = el("input");
  input.id = id;
  input.type = "text";
  input.maxLength = maxLength;
  input.autocomplete = "off";
  input.value = value || "";
  return input;
}

function joinUrl(code) {
  return window.location.origin + "/join.html#e=" + code;
}

/* ---------- Event form (new or edit) ---------- */

function eventForm(event, onDone) {
  const key = "ce-" + (event ? event.id : "new");
  const box = el("div");

  const title = textInput(key + "-title", event && event.title, 120);
  const host = textInput(key + "-host", event && event.host_name, 120);
  const date = el("input");
  date.id = key + "-date";
  date.type = "date";
  date.value = (event && event.event_date) || "";
  const location = textInput(key + "-location", event && event.location, 200);

  const mode = el("select");
  mode.id = key + "-mode";
  [
    ["manual", "Invitation only: I approve each guest"],
    ["auto", "Open: guests are approved automatically"],
  ].forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = (event ? event.approval_mode : "manual") === value;
    mode.appendChild(option);
  });

  const max = el("input");
  max.id = key + "-max";
  max.type = "number";
  max.min = "1";
  max.max = "5000";
  max.step = "1";
  max.inputMode = "numeric";
  max.value = event && event.max_guests ? String(event.max_guests) : "";

  const open = el("input");
  open.id = key + "-open";
  open.type = "checkbox";
  open.checked = event ? event.registration_open : true;
  const openLabel = el("label", "checkbox-label");
  openLabel.htmlFor = open.id;
  openLabel.append(
    open,
    document.createTextNode(" Registration is open (guests can sign up)"),
  );

  // Meals
  const current = ((event && event.meals) || []).map((meal) => meal.name);
  const mealBox = el("div", "menu-field");
  mealBox.appendChild(
    el(
      "p",
      null,
      "Which meals does this event include? Every approved guest gets one ticket per meal.",
    ),
  );
  const checks = [];
  PRESET_MEALS.forEach((name) => {
    const input = el("input");
    input.id = key + "-meal-" + name;
    input.type = "checkbox";
    input.checked = current.some(
      (existing) => existing.toLowerCase() === name.toLowerCase(),
    );
    const label = el("label", "checkbox-label");
    label.htmlFor = input.id;
    label.append(input, document.createTextNode(" " + name));
    checks.push({ name: name, input: input });
    mealBox.appendChild(label);
  });
  const extras = current.filter(
    (name) =>
      !PRESET_MEALS.some(
        (preset) => preset.toLowerCase() === name.toLowerCase(),
      ),
  );
  const custom1 = textInput(key + "-custom1", extras[0], 40);
  const custom2 = textInput(key + "-custom2", extras[1], 40);
  mealBox.append(
    field("Another meal (optional), for example Tea break", custom1),
    field("One more meal (optional)", custom2),
  );

  const save = el("button", "button", event ? "Save changes" : "Create event");
  save.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  save.addEventListener("click", async () => {
    const meals = checks
      .filter((entry) => entry.input.checked)
      .map((entry) => entry.name);
    [custom1.value.trim(), custom2.value.trim()].forEach((name) => {
      if (name) {
        meals.push(name);
      }
    });
    if (title.value.trim().length < 3) {
      message.textContent = "Please enter the event name.";
      title.focus();
      return;
    }
    if (!date.value) {
      message.textContent = "Please choose the event date.";
      date.focus();
      return;
    }
    if (meals.length === 0) {
      message.textContent = "Please choose at least one meal.";
      return;
    }
    save.disabled = true;
    message.textContent = "Saving...";
    try {
      await rpc("staff_save_catering_event", {
        p_id: event ? event.id : null,
        p_title: title.value.trim(),
        p_host: host.value.trim() || null,
        p_date: date.value,
        p_location: location.value.trim() || null,
        p_mode: mode.value,
        p_open: open.checked,
        p_max: max.value ? Number(max.value) : null,
        p_meals: meals,
      });
      message.textContent = "";
      await onDone(
        event ? "Event saved." : "Event created. Print its QR poster below.",
      );
    } catch (error) {
      console.error("Save event failed:", error);
      message.textContent = friendlyError(error);
      save.disabled = false;
    }
  });

  box.append(
    field("Event name *", title, "For example: Mensah Family Wedding"),
    field("Host or family name (optional)", host),
    field("Event date *", date),
    field("Place (optional)", location),
    field(
      "How should guests be approved?",
      mode,
      "Invitation only: guests wait until you approve them. Open: guests get their tickets instantly.",
    ),
    field(
      "Guest limit (optional)",
      max,
      "Approved guests cannot go above this number. Leave empty for no limit.",
    ),
    openLabel,
    mealBox,
    save,
    message,
  );
  return box;
}

function renderNew() {
  newBox.textContent = "";
  if (!can("cevents.manage")) {
    return;
  }
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Create a catering event"));
  card.appendChild(
    el(
      "p",
      null,
      "Use this when a host wants guests to register by scanning a QR code for their food tickets.",
    ),
  );
  card.appendChild(
    eventForm(null, async (text) => {
      await loadAll();
      say(text);
    }),
  );
  newBox.appendChild(card);
}

/* ---------- Waiting for approval ---------- */

async function decide(guestId, approve, reason) {
  await rpc("staff_decide_catering_guest", {
    p_guest_id: guestId,
    p_approve: approve,
    p_reason: reason || null,
  });
}

function guestActions(guest, after) {
  const row = el("div");
  if (guest.status !== "Approved") {
    const approve = el("button", "button", "Approve");
    approve.type = "button";
    approve.addEventListener("click", async () => {
      approve.disabled = true;
      try {
        await decide(guest.id, true);
        say(guest.full_name + " approved. Tickets issued.");
        await after();
      } catch (error) {
        say(friendlyError(error));
        approve.disabled = false;
      }
    });
    row.appendChild(approve);
  }
  if (guest.status !== "Rejected") {
    const reject = el(
      "button",
      "button button-danger",
      guest.status === "Approved" ? "Cancel approval" : "Reject",
    );
    reject.type = "button";
    reject.addEventListener("click", async () => {
      const reason = window.prompt(
        "Reason (optional, the guest can see it):",
        "",
      );
      if (reason === null) {
        return;
      }
      reject.disabled = true;
      try {
        await decide(guest.id, false, reason);
        say(guest.full_name + " is now rejected.");
        await after();
      } catch (error) {
        say(friendlyError(error));
        reject.disabled = false;
      }
    });
    row.appendChild(reject);
  }
  return row;
}

function renderPending() {
  pendingBox.textContent = "";
  pendingBox.appendChild(
    el("h2", null, "Waiting for Approval (" + pending.length + ")"),
  );
  if (pending.length === 0) {
    pendingBox.appendChild(
      el("p", null, "No guests are waiting. This list refreshes by itself."),
    );
    return;
  }
  pending.forEach((guest) => {
    const card = el("div", "card order-card");
    card.appendChild(el("h3", null, guest.full_name));
    const phoneParagraph = el("p");
    phoneParagraph.appendChild(el("strong", null, "Phone: "));
    const link = el("a", null, guest.phone);
    link.href = "tel:" + String(guest.phone).replace(/[^\d+]/g, "");
    phoneParagraph.appendChild(link);
    card.appendChild(phoneParagraph);
    const eventParagraph = el("p");
    eventParagraph.appendChild(el("strong", null, "Event: "));
    eventParagraph.appendChild(
      document.createTextNode(
        guest.event_title + " (" + timeAgo(guest.created_at) + ")",
      ),
    );
    card.appendChild(eventParagraph);
    card.appendChild(
      guestActions(Object.assign({ status: "Pending" }, guest), () =>
        loadAll(),
      ),
    );
    pendingBox.appendChild(card);
  });
}

/* ---------- Events and guests ---------- */

function guestRow(guest, event) {
  const card = el("div", "card order-card");
  card.appendChild(el("h4", null, guest.full_name));
  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " +
        (guest.status === "Approved"
          ? "badge-good"
          : guest.status === "Rejected"
            ? "badge-bad"
            : "badge-warn"),
      guest.status,
    ),
  );
  card.appendChild(badges);
  const phone = el("p");
  phone.appendChild(el("strong", null, "Phone: "));
  phone.appendChild(document.createTextNode(guest.phone));
  card.appendChild(phone);
  if (guest.reject_reason) {
    card.appendChild(el("p", null, "Reason: " + guest.reject_reason));
  }
  if (guest.tickets && guest.tickets.length > 0) {
    const list = el("ul");
    guest.tickets.forEach((ticket) => {
      list.appendChild(
        el(
          "li",
          null,
          ticket.meal +
            ": " +
            ticket.status +
            " (" +
            ticket.ticket_number +
            ")",
        ),
      );
    });
    card.appendChild(list);
  }
  card.appendChild(
    guestActions(guest, async () => {
      await loadAll();
    }),
  );
  const reset = el("button", "button button-secondary", "Reset PIN");
  reset.type = "button";
  reset.addEventListener("click", async () => {
    if (
      !window.confirm(
        "Give " +
          guest.full_name +
          " a new PIN? Their old PIN will stop working.",
      )
    ) {
      return;
    }
    reset.disabled = true;
    try {
      const result = await rpc("staff_reset_catering_pin", {
        p_guest_id: guest.id,
      });
      window.alert(
        "New PIN for " +
          guest.full_name +
          ": " +
          result.pin +
          "\n\nTell the guest. They use it with their phone number.",
      );
    } catch (error) {
      say(friendlyError(error));
    }
    reset.disabled = false;
  });
  card.appendChild(reset);
  return card;
}

function drawGuests(event, holder) {
  const state = openGuests[event.id];
  holder.textContent = "";
  if (!state) {
    return;
  }
  const filter = el("select");
  filter.id = "gf-" + event.id;
  [
    ["", "All guests"],
    ["Pending", "Waiting"],
    ["Approved", "Approved"],
    ["Rejected", "Rejected"],
  ].forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = state.filter === value;
    filter.appendChild(option);
  });
  const search = textInput("gs-" + event.id, state.search, 60);
  search.placeholder = "Search by name or phone";
  filter.addEventListener("change", async () => {
    state.filter = filter.value;
    await refreshGuests(event, holder);
  });
  search.addEventListener("input", () => {
    state.search = search.value;
    drawGuestRows(event, rows);
  });
  const rows = el("div");
  holder.append(field("Show", filter), field("Search", search), rows);
  drawGuestRows(event, rows);
}

function drawGuestRows(event, rows) {
  const state = openGuests[event.id];
  rows.textContent = "";
  const term = (state.search || "").trim().toLowerCase();
  const shown = (state.guests || []).filter(
    (guest) =>
      !term ||
      guest.full_name.toLowerCase().includes(term) ||
      String(guest.phone)
        .replace(/\D/g, "")
        .includes(term.replace(/\D/g, "") || "no-match") ||
      guest.phone.toLowerCase().includes(term),
  );
  if (shown.length === 0) {
    rows.appendChild(el("p", null, "No guests to show."));
    return;
  }
  shown.forEach((guest) => rows.appendChild(guestRow(guest, event)));
}

async function refreshGuests(event, holder) {
  const state = openGuests[event.id];
  state.guests =
    (await rpc("staff_get_catering_guests", {
      p_event_id: event.id,
      p_status: state.filter || null,
    })) || [];
  drawGuests(event, holder);
}

function eventCard(event) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, event.title));
  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge",
      event.approval_mode === "auto"
        ? "Open (auto approval)"
        : "Invitation only",
    ),
  );
  badges.appendChild(
    el(
      "span",
      "badge " + (event.registration_open ? "badge-good" : "badge-bad"),
      event.registration_open ? "Registration open" : "Registration closed",
    ),
  );
  card.appendChild(badges);
  const when = el("p");
  when.appendChild(el("strong", null, "Date: "));
  when.appendChild(document.createTextNode(longDate(event.event_date)));
  card.appendChild(when);
  if (event.host_name) {
    const host = el("p");
    host.appendChild(el("strong", null, "Host: "));
    host.appendChild(document.createTextNode(event.host_name));
    card.appendChild(host);
  }
  if (event.location) {
    const place = el("p");
    place.appendChild(el("strong", null, "Place: "));
    place.appendChild(document.createTextNode(event.location));
    card.appendChild(place);
  }
  card.appendChild(
    el(
      "p",
      null,
      "Waiting: " +
        event.pending +
        "  |  Approved: " +
        event.approved +
        "  |  Rejected: " +
        event.rejected +
        (event.max_guests ? "  |  Limit: " + event.max_guests : ""),
    ),
  );
  const mealList = el("ul");
  (event.meals || []).forEach((meal) => {
    mealList.appendChild(
      el(
        "li",
        null,
        meal.name +
          ": " +
          meal.served +
          " served of " +
          meal.total +
          " tickets",
      ),
    );
  });
  card.appendChild(mealList);

  const actions = el("div");
  const poster = el("a", "button", "Print QR poster");
  poster.href = "catering-poster.html#e=" + event.join_code;
  poster.target = "_blank";
  poster.rel = "noopener";
  actions.appendChild(poster);

  const copy = el("button", "button button-secondary", "Copy guest link");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(joinUrl(event.join_code));
      copy.textContent = "Copied";
    } catch (error) {
      window.prompt("Copy this link:", joinUrl(event.join_code));
    }
  });
  actions.appendChild(copy);

  if (event.pending > 0 && can("cevents.approve")) {
    const all = el(
      "button",
      "button",
      "Approve all waiting (" + event.pending + ")",
    );
    all.type = "button";
    all.addEventListener("click", async () => {
      if (
        !window.confirm(
          "Approve all " +
            event.pending +
            " waiting guests for " +
            event.title +
            "?",
        )
      ) {
        return;
      }
      all.disabled = true;
      try {
        const result = await rpc("staff_approve_all_catering", {
          p_event_id: event.id,
        });
        say(
          result.approved +
            " guests approved" +
            (result.skipped > 0
              ? ". " +
                result.skipped +
                " left waiting because the guest limit was reached."
              : "."),
        );
        await loadAll();
      } catch (error) {
        say(friendlyError(error));
        all.disabled = false;
      }
    });
    actions.appendChild(all);
  }
  card.appendChild(actions);

  const holder = el("div");
  const toggle = el(
    "button",
    "button button-secondary",
    openGuests[event.id] ? "Hide guests" : "Show guests",
  );
  toggle.type = "button";
  toggle.addEventListener("click", async () => {
    if (openGuests[event.id]) {
      delete openGuests[event.id];
      holder.textContent = "";
      toggle.textContent = "Show guests";
      return;
    }
    openGuests[event.id] = { filter: "", search: "", guests: [] };
    toggle.textContent = "Hide guests";
    try {
      await refreshGuests(event, holder);
    } catch (error) {
      say(friendlyError(error));
    }
  });
  card.append(toggle, holder);
  if (openGuests[event.id]) {
    refreshGuests(event, holder).catch((error) => say(friendlyError(error)));
  }

  if (can("cevents.manage")) {
    const details = el("details");
    details.appendChild(el("summary", null, "Edit this event"));
    details.appendChild(
      eventForm(event, async (text) => {
        await loadAll();
        say(text);
      }),
    );
    card.appendChild(details);
  }
  return card;
}

function renderEvents() {
  eventList.textContent = "";
  if (events.length === 0) {
    eventList.appendChild(el("p", null, "No catering events yet."));
    return;
  }
  events.forEach((event) => eventList.appendChild(eventCard(event)));
}

function someoneIsEditing() {
  if (eventList.querySelector("details[open]")) {
    return true;
  }
  const active = document.activeElement;
  return Boolean(
    active &&
    eventList.contains(active) &&
    ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName),
  );
}

async function loadAll(quiet) {
  const [eventData, pendingData] = await Promise.all([
    rpc("staff_list_catering_events"),
    rpc("staff_get_catering_pending"),
  ]);
  events = eventData || [];
  pending = pendingData || [];
  document.title =
    (pending.length > 0 ? "(" + pending.length + ") " : "") + BASE_TITLE;
  renderPending();
  // The automatic refresh never rebuilds the cards while someone is typing in them
  if (!quiet || !someoneIsEditing()) {
    renderEvents();
  }
}

/* ---------- Start ---------- */

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

refreshButton.addEventListener("click", async () => {
  say("Loading...");
  try {
    await loadAll();
    say("");
  } catch (error) {
    say(friendlyError(error));
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
  if (!can("cevents.approve") && !can("cevents.manage")) {
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
  renderNew();
  say("Loading...");
  try {
    await loadAll();
    say("");
  } catch (loadError) {
    console.error("Load error:", loadError);
    say(friendlyError(loadError));
  }
  // New guests appear without pressing anything
  setInterval(async () => {
    if (document.hidden) {
      return;
    }
    try {
      await loadAll(true);
    } catch (error) {
      /* try again next time */
    }
  }, 10000);
}

start();
