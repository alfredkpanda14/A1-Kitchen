/* A1 Kitchen: Today's Specials (staff who may manage the menu) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const summaryBox = document.getElementById("special-summary");
const listBox = document.getElementById("special-list");
const filterInput = document.getElementById("special-filter");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");

const MAX_SPECIALS = 6;

let staff = null;
let items = [];
let serverToday = new Date().toISOString().slice(0, 10);

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

function addDays(dateText, days) {
  const date = new Date(dateText + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDate(dateText) {
  const date = new Date(dateText + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) {
    return dateText || "";
  }
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function priceText(price) {
  if (price === null || price === undefined || price === "") {
    return "Price on request";
  }
  return "NLe " + Number(price).toLocaleString("en-GB");
}

/* ---------- Drawing ---------- */

function showingCount() {
  return items.filter((item) => item.showing).length;
}

function drawSummary() {
  const count = showingCount();
  summaryBox.textContent =
    count === 0
      ? "No specials are showing on the home page right now."
      : count +
        " of " +
        MAX_SPECIALS +
        (count === 1 ? " special is" : " specials are") +
        " showing on the home page.";
}

function statusBadge(item) {
  if (!item.available) {
    return el("span", "badge badge-bad", "Switched off on the menu");
  }
  if (item.showing) {
    return el(
      "span",
      "badge badge-good",
      item.special_until === serverToday
        ? "Showing today"
        : "Showing until " + shortDate(item.special_until),
    );
  }
  if (item.is_special) {
    return el(
      "span",
      "badge badge-warn",
      "Ended " + shortDate(item.special_until),
    );
  }
  return null;
}

function photo(item) {
  const box = el("div", "special-thumb");
  if (item.image_path) {
    const image = el("img");
    image.src = item.image_path;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    box.appendChild(image);
  } else {
    box.appendChild(el("span", null, "🍲"));
  }
  return box;
}

async function save(item, on, note, until, buttons) {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  say(on ? "Saving..." : "Stopping the special...");
  try {
    await rpc("staff_set_special", {
      p_id: item.id,
      p_on: on,
      p_note: on ? note : null,
      p_until: on ? until : null,
    });
    say(
      on
        ? item.name + " is now a special until " + shortDate(until) + "."
        : item.name + " is no longer a special.",
    );
    await load();
  } catch (error) {
    say(friendlyError(error));
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function row(item) {
  const card = el("article", "special-row");
  if (item.showing) {
    card.classList.add("is-on");
  }
  card.appendChild(photo(item));

  const info = el("div", "special-info");
  info.appendChild(el("h3", null, item.name));
  info.appendChild(
    el(
      "p",
      "special-sub",
      [item.category, priceText(item.price)].filter(Boolean).join(" · "),
    ),
  );
  const badge = statusBadge(item);
  if (badge) {
    info.appendChild(badge);
  }
  card.appendChild(info);

  const controls = el("div", "special-controls");
  if (!item.available) {
    controls.appendChild(
      el(
        "p",
        "field-help",
        "Switch this food on in the Menu Manager before making it a special.",
      ),
    );
    if (item.is_special) {
      const stop = el("button", "button button-secondary", "Stop special");
      stop.type = "button";
      stop.addEventListener("click", () =>
        save(item, false, null, null, [stop]),
      );
      controls.appendChild(stop);
    }
    card.appendChild(controls);
    return card;
  }

  const noteId = "note-" + item.id;
  const untilId = "until-" + item.id;

  const noteField = el("div", "menu-field");
  const noteLabel = el("label", null, "Short note (optional)");
  noteLabel.htmlFor = noteId;
  const note = el("input");
  note.id = noteId;
  note.type = "text";
  note.maxLength = 60;
  note.autocomplete = "off";
  note.placeholder = "e.g. Today only";
  note.value = item.special_note || "";
  noteField.append(noteLabel, note);

  const untilField = el("div", "menu-field");
  const untilLabel = el("label", null, "Last day to show");
  untilLabel.htmlFor = untilId;
  const until = el("input");
  until.id = untilId;
  until.type = "date";
  until.min = serverToday;
  until.max = addDays(serverToday, 30);
  until.value =
    item.showing && item.special_until ? item.special_until : serverToday;
  untilField.append(untilLabel, until);

  const buttons = el("div", "special-buttons");
  const go = el(
    "button",
    "button",
    item.showing ? "Save changes" : "Show as special",
  );
  go.type = "button";
  const all = [go];
  buttons.appendChild(go);
  if (item.is_special) {
    const stop = el("button", "button button-secondary", "Stop special");
    stop.type = "button";
    all.push(stop);
    stop.addEventListener("click", () => save(item, false, null, null, all));
    buttons.appendChild(stop);
  }
  go.addEventListener("click", () => {
    const day = until.value || serverToday;
    if (day < serverToday) {
      say("The last day cannot be in the past.");
      until.focus();
      return;
    }
    if (day > addDays(serverToday, 30)) {
      say("A special can run for 30 days at most.");
      until.focus();
      return;
    }
    if (!item.showing && showingCount() >= MAX_SPECIALS) {
      say("Up to 6 specials can show at a time. Please stop one first.");
      return;
    }
    save(item, true, note.value.trim(), day, all);
  });

  controls.append(noteField, untilField, buttons);
  card.appendChild(controls);
  return card;
}

function drawList() {
  listBox.textContent = "";
  const term = filterInput.value.trim().toLowerCase();
  const shown = items.filter(
    (item) => !term || String(item.name).toLowerCase().includes(term),
  );
  if (items.length === 0) {
    listBox.appendChild(
      el("p", "guide-empty", "There are no foods on the menu yet."),
    );
    return;
  }
  if (shown.length === 0) {
    listBox.appendChild(el("p", "field-help", "No food matches that name."));
    return;
  }
  /* Specials that are showing come first, then the rest by category */
  const ordered = shown
    .filter((item) => item.showing)
    .concat(shown.filter((item) => !item.showing));
  let lastGroup = null;
  ordered.forEach((item) => {
    const group = item.showing
      ? "Showing on the home page"
      : item.category || "Other foods";
    if (group !== lastGroup) {
      listBox.appendChild(el("h3", "special-group", group));
      lastGroup = group;
    }
    listBox.appendChild(row(item));
  });
}

async function load() {
  const result = await rpc("staff_specials_list");
  items = (result && result.items) || [];
  if (result && result.today) {
    serverToday = String(result.today).slice(0, 10);
  }
  drawSummary();
  drawList();
}

/* ---------- Start ---------- */

filterInput.addEventListener("input", drawList);

refreshButton.addEventListener("click", async () => {
  say("Refreshing...");
  try {
    await load();
    say("");
  } catch (error) {
    say(friendlyError(error));
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
  if (!can("menu.manage")) {
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
    String(staff.role || "").replace(/_/g, " ") +
    ")";
  try {
    await load();
  } catch (loadError) {
    say(friendlyError(loadError));
  }
}

start();
