/* A1 Kitchen: Feast Passes (paid and guest passes for free food, drink and water) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const eventSelect = document.getElementById("event-select");
const reportBox = document.getElementById("report-box");
const guestBox = document.getElementById("guest-box");
const filterType = document.getElementById("filter-type");
const filterSearch = document.getElementById("filter-search");
const filterUnprinted = document.getElementById("filter-unprinted");
const printSelectedButton = document.getElementById("print-selected");
const printUnprintedButton = document.getElementById("print-unprinted");
const tableBody = document.getElementById("pass-body");
const tableEmpty = document.getElementById("pass-empty");

const EVENT_KEY = "a1KitchenPassEvent";

let staff = null;
let events = [];
let data = null;
const selected = new Set();

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

function shortStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value) {
  return "NLe " + Number(value || 0);
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
  const { data: result, error } = await supabaseClient.rpc(name, params || {});
  if (error) {
    if (error.code === "PGRST301" || /jwt/i.test(error.message || "")) {
      goTo("staff-login.html");
    }
    throw new Error(error.message || "Request failed");
  }
  return result;
}

/* ---------- Summary ---------- */

function reportCard(label, value, alert) {
  const card = el("div", "glance-card" + (alert ? " is-alert" : ""));
  card.appendChild(el("strong", null, String(value)));
  card.appendChild(el("span", null, label));
  return card;
}

function renderReport() {
  reportBox.textContent = "";
  if (!data) {
    return;
  }
  const paid = data.report.paid;
  const guest = data.report.guest;
  const total = Number(paid.people) + Number(guest.people);

  reportBox.appendChild(el("h3", null, "Paid tickets"));
  const paidGrid = el("div", "glance-grid");
  paidGrid.append(
    reportCard(
      "People who paid (" + paid.passes + " passes)",
      paid.people,
      false,
    ),
    reportCard("Entered", paid.entered + " of " + paid.people, false),
    reportCard("Food served", paid.food + " of " + paid.people, false),
    reportCard("Drinks served", paid.drink + " of " + paid.people, false),
    reportCard("Water served", paid.water + " of " + paid.people, false),
  );
  reportBox.appendChild(paidGrid);

  reportBox.appendChild(el("h3", null, "Guests (free)"));
  const guestGrid = el("div", "glance-grid");
  guestGrid.append(
    reportCard(
      "Guests invited (" + guest.passes + " passes)",
      guest.people,
      false,
    ),
    reportCard("Entered free", guest.entered + " of " + guest.people, false),
    reportCard("Food served", guest.food + " of " + guest.people, false),
    reportCard("Drinks served", guest.drink + " of " + guest.people, false),
    reportCard("Water served", guest.water + " of " + guest.people, false),
  );
  reportBox.appendChild(guestGrid);

  const all = el("p", "menu-notice");
  all.textContent =
    "Everyone expected at this event: " +
    total +
    " people (" +
    paid.people +
    " paid and " +
    guest.people +
    " guests).";
  reportBox.appendChild(all);
}

/* ---------- Guest passes (Developer) ---------- */

function renderGuestForm() {
  guestBox.textContent = "";
  if (!can("passes.guest")) {
    return;
  }
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Create guest passes"));
  card.appendChild(
    el(
      "p",
      null,
      "For people Chef A1 invites who do not pay. Write one guest per line. To give a guest more than one place, write a comma and the number, for example: Aminata Sesay, 3",
    ),
  );
  const names = el("textarea");
  names.id = "guest-names";
  names.rows = 6;
  names.maxLength = 8000;
  names.placeholder =
    "Aminata Sesay\nHon. Ibrahim Bangura, 2\nPastor John Kamara, 4";
  const nameLabel = el("label", null, "Guests (one per line)");
  nameLabel.htmlFor = names.id;
  const note = el("input");
  note.id = "guest-note";
  note.type = "text";
  note.maxLength = 100;
  note.autocomplete = "off";
  note.placeholder = "For example: Chef A1's guest";
  const noteLabel = el(
    "label",
    null,
    "Note printed on these passes (optional)",
  );
  noteLabel.htmlFor = note.id;
  const button = el("button", "button", "Create guest passes");
  button.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  button.addEventListener("click", async () => {
    const lines = names.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      message.textContent = "Please write at least one guest.";
      return;
    }
    const guests = lines.map((line) => {
      const match = line.match(/^(.*?)[,;]\s*(\d{1,3})\s*$/);
      const name = (match ? match[1] : line).trim();
      return {
        name: name,
        people: match ? Number(match[2]) : 1,
        note: note.value.trim() || null,
      };
    });
    if (!eventSelect.value) {
      message.textContent = "Please choose the event first.";
      return;
    }
    button.disabled = true;
    message.textContent = "Creating...";
    try {
      const result = await rpc("staff_create_guest_passes", {
        p_event_id: eventSelect.value,
        p_guests: guests,
      });
      names.value = "";
      message.textContent =
        result.created +
        ' guest passes created. They are selected below. Press "Print selected passes".';
      (result.numbers || []).forEach((number) => selected.add("n:" + number));
      await loadPasses();
      printSelectedButton.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch (error) {
      console.error("Create guest passes failed:", error);
      message.textContent = friendlyError(error);
    }
    button.disabled = false;
  });

  card.append(nameLabel, names, noteLabel, note, button, message);
  guestBox.appendChild(card);
}

/* ---------- Table ---------- */

function passDetail(pass) {
  if (pass.kind === "guest") {
    return pass.note || "";
  }
  const items = (pass.items || [])
    .map((item) => item.quantity + " " + item.name)
    .join(", ");
  return (
    "Registration " +
    (pass.registration_number || "") +
    (items ? ". " + items : "")
  );
}

function isSelected(pass) {
  return selected.has(pass.id) || selected.has("n:" + pass.pass_number);
}

function toggleSelected(pass, on) {
  selected.delete("n:" + pass.pass_number);
  if (on) {
    selected.add(pass.id);
  } else {
    selected.delete(pass.id);
  }
  updateButtons();
}

function visiblePasses() {
  const type = filterType.value;
  const term = filterSearch.value.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  return (data ? data.passes : []).filter((pass) => {
    if (type && pass.kind !== type) {
      return false;
    }
    if (filterUnprinted.checked && (pass.printed_at || pass.voided)) {
      return false;
    }
    if (!term) {
      return true;
    }
    return (
      pass.holder_name.toLowerCase().includes(term) ||
      pass.pass_number.toLowerCase().includes(term) ||
      String(pass.registration_number || "")
        .toLowerCase()
        .includes(term) ||
      (digits.length >= 3 &&
        String(pass.holder_phone || "")
          .replace(/\D/g, "")
          .includes(digits))
    );
  });
}

function cell(text, className) {
  return el("td", className || null, text);
}

function renderTable() {
  tableBody.textContent = "";
  const list = visiblePasses();
  tableEmpty.hidden = list.length > 0;
  list.forEach((pass) => {
    const row = el("tr");
    if (pass.voided) {
      row.className = "row-void";
    }

    const check = el("input");
    check.type = "checkbox";
    check.checked = isSelected(pass);
    check.disabled = pass.voided;
    check.setAttribute("aria-label", "Select the pass of " + pass.holder_name);
    check.addEventListener("change", () => toggleSelected(pass, check.checked));
    const checkCell = el("td");
    checkCell.appendChild(check);
    row.appendChild(checkCell);

    row.appendChild(cell(pass.holder_name, "pass-name"));

    const typeCell = el("td");
    typeCell.appendChild(
      el(
        "span",
        "badge " + (pass.kind === "paid" ? "badge-good" : "badge-warn"),
        pass.kind === "paid" ? "Paid" : "Guest",
      ),
    );
    if (pass.voided) {
      typeCell.appendChild(el("span", "badge badge-bad", "Cancelled"));
    }
    row.appendChild(typeCell);

    row.appendChild(cell(String(pass.people)));
    row.appendChild(cell(pass.holder_phone || ""));

    const detailCell = el("td");
    detailCell.appendChild(el("span", null, passDetail(pass)));
    if (
      pass.kind === "paid" &&
      Number(pass.total_amount) > Number(pass.amount_paid)
    ) {
      detailCell.appendChild(
        el(
          "span",
          "pass-warning",
          "Balance not paid: " +
            money(Number(pass.total_amount) - Number(pass.amount_paid)),
        ),
      );
    }
    row.appendChild(detailCell);

    row.appendChild(cell(pass.pass_number, "pass-number-cell"));
    row.appendChild(cell(pass.entered + "/" + pass.people));
    row.appendChild(cell(pass.food_served + "/" + pass.people));
    row.appendChild(cell(pass.drink_served + "/" + pass.people));
    row.appendChild(cell(pass.water_served + "/" + pass.people));
    row.appendChild(
      cell(
        pass.printed_at
          ? "Yes (" + pass.print_count + "x), " + shortStamp(pass.printed_at)
          : "Not yet",
      ),
    );

    const actions = el("td");
    if (!pass.voided) {
      const print = el("button", "button button-secondary", "Print");
      print.type = "button";
      print.addEventListener("click", () => printPasses([pass]));
      actions.appendChild(print);
      if (pass.kind === "guest" && can("passes.guest")) {
        const cancel = el("button", "button button-danger", "Cancel");
        cancel.type = "button";
        cancel.addEventListener("click", async () => {
          if (
            !window.confirm(
              "Cancel the guest pass of " +
                pass.holder_name +
                "? It will stop working.",
            )
          ) {
            return;
          }
          try {
            await rpc("staff_void_guest_pass", { p_id: pass.id });
            say("The pass of " + pass.holder_name + " was cancelled.");
            await loadPasses();
          } catch (error) {
            say(friendlyError(error));
          }
        });
        actions.appendChild(cancel);
      }
    }
    row.appendChild(actions);
    tableBody.appendChild(row);
  });
  updateButtons();
}

function selectedPasses() {
  return (data ? data.passes : []).filter(
    (pass) => !pass.voided && isSelected(pass),
  );
}

function updateButtons() {
  const count = selectedPasses().length;
  printSelectedButton.textContent = "Print selected passes (" + count + ")";
  printSelectedButton.disabled = count === 0;
  const unprinted = (data ? data.passes : []).filter(
    (pass) => !pass.voided && !pass.printed_at,
  ).length;
  printUnprintedButton.textContent =
    "Print all passes not printed yet (" + unprinted + ")";
  printUnprintedButton.disabled = unprinted === 0;
}

/* ---------- Printing ---------- */

function toPdfPass(pass) {
  return {
    kind: pass.kind,
    passNumber: pass.pass_number,
    holder: pass.holder_name,
    phone: pass.holder_phone,
    people: pass.people,
    eventTitle: data.event.title,
    eventDate: data.event.event_date,
    detail: passDetail(pass),
    verifyUrl: window.location.origin + "/gate.html#t=" + pass.pass_number,
  };
}

async function printPasses(list) {
  if (list.length === 0) {
    say("Please choose at least one pass.");
    return;
  }
  const unpaid = list.filter(
    (pass) =>
      pass.kind === "paid" &&
      Number(pass.total_amount) > Number(pass.amount_paid),
  );
  if (
    unpaid.length > 0 &&
    !window.confirm(
      unpaid.length +
        " of these passes still have a balance to pay. Print them anyway?",
    )
  ) {
    return;
  }
  say(
    "Preparing " +
      list.length +
      (list.length === 1 ? " pass" : " passes") +
      " for printing...",
  );
  try {
    await A1PassPdf.download(
      list.map(toPdfPass),
      "A1-Feast-Passes-" + new Date().toISOString().slice(0, 10) + ".pdf",
    );
    await rpc("staff_mark_passes_printed", {
      p_ids: list.map((pass) => pass.id),
    });
    list.forEach((pass) => selected.delete(pass.id));
    say(
      "Done. The PDF is ready: open it and print it on A4 paper. Four passes fit on each page. Cut along the dotted lines.",
    );
    await loadPasses();
  } catch (error) {
    console.error("Print failed:", error);
    say(friendlyError(error));
  }
}

/* ---------- Loading ---------- */

async function loadPasses() {
  if (!eventSelect.value) {
    data = null;
    renderReport();
    renderTable();
    return;
  }
  data = await rpc("staff_list_event_passes", {
    p_event_id: eventSelect.value,
  });
  // passes created a moment ago are selected by their number
  data.passes.forEach((pass) => {
    if (selected.has("n:" + pass.pass_number)) {
      selected.delete("n:" + pass.pass_number);
      selected.add(pass.id);
    }
  });
  renderReport();
  renderTable();
}

eventSelect.addEventListener("change", async () => {
  selected.clear();
  try {
    localStorage.setItem(EVENT_KEY, eventSelect.value);
  } catch (error) {
    /* ignore */
  }
  say("Loading...");
  try {
    await loadPasses();
    say("");
  } catch (error) {
    say(friendlyError(error));
  }
});
filterType.addEventListener("change", renderTable);
filterUnprinted.addEventListener("change", renderTable);
filterSearch.addEventListener("input", renderTable);
printSelectedButton.addEventListener("click", () =>
  printPasses(selectedPasses()),
);
printUnprintedButton.addEventListener("click", () =>
  printPasses(
    (data ? data.passes : []).filter(
      (pass) => !pass.voided && !pass.printed_at,
    ),
  ),
);
refreshButton.addEventListener("click", async () => {
  say("Loading...");
  try {
    await loadPasses();
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
  if (!can("passes.manage")) {
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

  try {
    events = (await rpc("staff_list_events")) || [];
  } catch (loadError) {
    say(friendlyError(loadError));
    return;
  }
  events
    .slice()
    .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
    .forEach((event) => {
      const option = el(
        "option",
        null,
        event.title + " (" + longDate(event.event_date) + ")",
      );
      option.value = event.id;
      eventSelect.appendChild(option);
    });
  let remembered = "";
  try {
    remembered = localStorage.getItem(EVENT_KEY) || "";
  } catch (storageError) {
    remembered = "";
  }
  if (remembered && events.some((event) => event.id === remembered)) {
    eventSelect.value = remembered;
  }
  renderGuestForm();
  say("Loading...");
  try {
    await loadPasses();
    say(events.length === 0 ? "There are no events yet." : "");
  } catch (loadError) {
    console.error("Load error:", loadError);
    say(friendlyError(loadError));
  }
}

start();
