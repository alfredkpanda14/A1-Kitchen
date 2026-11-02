/* A1 Kitchen: Gate tickets (walk-in sales) and the online discount (Developer only) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const eventSelect = document.getElementById("event-select");
const discountBox = document.getElementById("discount-box");
const sellBox = document.getElementById("sell-box");
const reportBox = document.getElementById("report-box");
const tableBody = document.getElementById("ticket-body");
const tableEmpty = document.getElementById("ticket-empty");

const EVENT_KEY = "a1KitchenGateEvent";

let staff = null;
let events = [];
let data = null;

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

function numberInput(id, value, min, max) {
  const input = el("input");
  input.id = id;
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.inputMode = "numeric";
  input.value = String(value);
  return input;
}

/* ---------- Online discount ---------- */

function renderDiscount() {
  discountBox.textContent = "";
  if (!data) {
    return;
  }
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Online discount"));
  card.appendChild(
    el(
      "p",
      null,
      "People who register and pay on the website get this discount. People who buy at the gate pay the full gate price. The gate price is the price you set for each ticket category on the Events page.",
    ),
  );

  const percent = el("input");
  percent.id = "discount-percent";
  percent.type = "number";
  percent.min = "0";
  percent.max = "90";
  percent.step = "1";
  percent.inputMode = "numeric";
  percent.value = String(data.discount_percent);
  const save = el("button", "button", "Save discount");
  save.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  const table = el("div", "table-container");
  const grid = el("table");
  const head = el("thead");
  const headRow = el("tr");
  [
    "Ticket category",
    "Gate price",
    "Website price",
    "Website buyers save",
  ].forEach((text) => headRow.appendChild(el("th", null, text)));
  head.appendChild(headRow);
  const body = el("tbody");
  grid.append(head, body);
  table.appendChild(grid);

  function drawTypes(value) {
    body.textContent = "";
    (data.types || []).forEach((type) => {
      const online = Math.round(Number(type.gate_price) * (100 - value)) / 100;
      const row = el("tr");
      row.append(
        el("td", null, type.name + (type.active ? "" : " (switched off)")),
        el("td", null, money(type.gate_price)),
        el("td", null, money(online)),
        el(
          "td",
          null,
          money(Math.round((Number(type.gate_price) - online) * 100) / 100),
        ),
      );
      body.appendChild(row);
    });
    if ((data.types || []).length === 0) {
      const row = el("tr");
      const cellNode = el(
        "td",
        null,
        "This event has no ticket categories yet. Add them on the Events page first.",
      );
      cellNode.colSpan = 4;
      row.appendChild(cellNode);
      body.appendChild(row);
    }
  }
  drawTypes(Number(data.discount_percent));
  percent.addEventListener("input", () => {
    const value = Math.min(90, Math.max(0, Number(percent.value) || 0));
    drawTypes(value);
  });

  save.addEventListener("click", async () => {
    const value = Number(percent.value);
    if (!Number.isFinite(value) || value < 0 || value > 90) {
      message.textContent = "Please enter a number from 0 to 90.";
      return;
    }
    save.disabled = true;
    message.textContent = "Saving...";
    try {
      await rpc("staff_set_event_discount", {
        p_event_id: eventSelect.value,
        p_percent: value,
      });
      message.textContent =
        "Saved. New website prices are shown on the Events page.";
      await loadAll();
    } catch (error) {
      message.textContent = friendlyError(error);
      save.disabled = false;
    }
  });

  card.append(
    field(
      "Discount for people who pay online (%)",
      percent,
      "Use 0 for no discount.",
    ),
    table,
    save,
    message,
  );
  discountBox.appendChild(card);
}

/* ---------- Selling gate tickets ---------- */

function renderSell() {
  sellBox.textContent = "";
  if (!data) {
    return;
  }
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Sell gate tickets"));
  card.appendChild(
    el(
      "p",
      null,
      "For people who cannot use the website. Collect the gate price in cash, then create the ticket here and give them the printed Gate Ticket. Each ticket has a QR code that is scanned at the gate.",
    ),
  );
  const types = (data.types || []).filter((type) => type.active);
  if (types.length === 0) {
    card.appendChild(
      el(
        "p",
        "menu-notice",
        "This event has no active ticket categories. Add one on the Events page first.",
      ),
    );
    sellBox.appendChild(card);
    return;
  }

  const typeSelect = el("select");
  typeSelect.id = "gt-type";
  types.forEach((type) => {
    const option = el(
      "option",
      null,
      type.name + " (gate price " + money(type.gate_price) + ")",
    );
    option.value = type.id;
    typeSelect.appendChild(option);
  });
  const people = numberInput("gt-people", 1, 1, 50);
  const count = numberInput("gt-count", 1, 1, 100);
  const buyer = el("input");
  buyer.id = "gt-buyer";
  buyer.type = "text";
  buyer.maxLength = 100;
  buyer.autocomplete = "off";
  buyer.placeholder = "Gate visitor";
  const total = el("p", "menu-notice");
  const button = el("button", "button", "Create and download gate tickets");
  button.type = "button";
  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  function showTotal() {
    const type = types.find((item) => item.id === typeSelect.value);
    const each = type
      ? Number(type.gate_price) * (Number(people.value) || 0)
      : 0;
    const tickets = Number(count.value) || 0;
    total.textContent =
      "Collect " +
      money(each) +
      " for each ticket. " +
      tickets +
      (tickets === 1 ? " ticket" : " tickets") +
      " in total: " +
      money(each * tickets) +
      ".";
  }
  [typeSelect, people, count].forEach((node) =>
    node.addEventListener("input", showTotal),
  );
  showTotal();

  button.addEventListener("click", async () => {
    const peopleValue = Number(people.value);
    const countValue = Number(count.value);
    if (!Number.isInteger(peopleValue) || peopleValue < 1 || peopleValue > 50) {
      message.textContent = "People on each ticket must be from 1 to 50.";
      return;
    }
    if (!Number.isInteger(countValue) || countValue < 1 || countValue > 100) {
      message.textContent = "You can create from 1 to 100 tickets at a time.";
      return;
    }
    button.disabled = true;
    message.textContent = "Creating...";
    try {
      const result = await rpc("staff_create_gate_tickets", {
        p_event_id: eventSelect.value,
        p_ticket_type_id: typeSelect.value,
        p_people: peopleValue,
        p_count: countValue,
        p_buyer: buyer.value.trim() || null,
      });
      message.textContent =
        result.tickets.length +
        " gate tickets created. The PDF is downloading.";
      await A1TicketPdf.download(
        result.tickets.map(toPdfTicket),
        "A1-Gate-Tickets-" + new Date().toISOString().slice(0, 10) + ".pdf",
      );
      await loadAll();
    } catch (error) {
      console.error("Create gate tickets failed:", error);
      message.textContent = friendlyError(error);
    }
    button.disabled = false;
  });

  card.append(
    field("Ticket category", typeSelect),
    field("People on each ticket", people),
    field(
      "How many tickets?",
      count,
      "Use more than 1 to print several tickets in one go.",
    ),
    field("Buyer's name (optional)", buyer),
    total,
    button,
    message,
  );
  sellBox.appendChild(card);
}

function toPdfTicket(ticket) {
  return {
    kind: "gate",
    ticketNumber: ticket.ticket_number,
    eventTitle: data.event.title,
    eventDate: data.event.event_date,
    startTime: data.event.start_time || "",
    location: data.event.location || "",
    holder: ticket.buyer_name,
    regNumber: "",
    approvedAt: ticket.created_at,
    amount: ticket.total_amount,
    method: "Cash at the gate",
    items: [{ name: ticket.ticket_name, quantity: ticket.people }],
    contact: typeof SITE_INFO !== "undefined" ? SITE_INFO.phone : "",
    verifyUrl: window.location.origin + "/gate.html#t=" + ticket.ticket_number,
  };
}

/* ---------- Report and table ---------- */

function reportCard(label, value) {
  const card = el("div", "glance-card");
  card.appendChild(el("strong", null, String(value)));
  card.appendChild(el("span", null, label));
  return card;
}

function renderReport() {
  reportBox.textContent = "";
  if (!data) {
    return;
  }
  const report = data.report;
  reportBox.appendChild(el("h3", null, "Paid on the website"));
  const web = el("div", "glance-grid");
  web.append(
    reportCard("People with paid website tickets", report.web_people),
    reportCard("Entered", report.web_entered + " of " + report.web_people),
  );
  reportBox.appendChild(web);
  reportBox.appendChild(el("h3", null, "Bought at the gate"));
  const gate = el("div", "glance-grid");
  gate.append(
    reportCard("Gate tickets sold", report.gate_tickets),
    reportCard("People on gate tickets", report.gate_people),
    reportCard("Cash collected at the gate", money(report.gate_money)),
    reportCard("Entered", report.gate_entered + " of " + report.gate_people),
  );
  reportBox.appendChild(gate);
}

function renderTable() {
  tableBody.textContent = "";
  const tickets = data ? data.tickets : [];
  tableEmpty.hidden = tickets.length > 0;
  tickets.forEach((ticket) => {
    const row = el("tr");
    if (ticket.voided) {
      row.className = "row-void";
    }
    row.appendChild(el("td", "pass-number-cell", ticket.ticket_number));
    row.appendChild(el("td", "pass-name", ticket.buyer_name));
    row.appendChild(el("td", null, ticket.ticket_name));
    row.appendChild(el("td", null, String(ticket.people)));
    row.appendChild(el("td", null, money(ticket.total_amount)));
    row.appendChild(
      el("td", null, ticket.admitted_count + "/" + ticket.people),
    );
    const state = el("td");
    state.appendChild(
      el(
        "span",
        "badge " + (ticket.voided ? "badge-bad" : "badge-good"),
        ticket.voided ? "Cancelled" : "Valid",
      ),
    );
    row.appendChild(state);
    row.appendChild(el("td", null, shortStamp(ticket.created_at)));

    const actions = el("td");
    if (!ticket.voided) {
      const download = el("button", "button button-secondary", "Download");
      download.type = "button";
      download.addEventListener("click", async () => {
        download.disabled = true;
        try {
          await A1TicketPdf.download(
            [toPdfTicket(ticket)],
            "A1-Gate-Ticket-" + ticket.ticket_number + ".pdf",
          );
        } catch (error) {
          say(friendlyError(error));
        }
        download.disabled = false;
      });
      const cancel = el("button", "button button-danger", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", async () => {
        if (
          !window.confirm(
            "Cancel gate ticket " +
              ticket.ticket_number +
              "? It will stop working at the gate.",
          )
        ) {
          return;
        }
        try {
          await rpc("staff_void_gate_ticket", { p_id: ticket.id });
          say("Gate ticket " + ticket.ticket_number + " was cancelled.");
          await loadAll();
        } catch (error) {
          say(friendlyError(error));
        }
      });
      actions.append(download, cancel);
    }
    row.appendChild(actions);
    tableBody.appendChild(row);
  });
}

/* ---------- Loading ---------- */

async function loadAll() {
  if (!eventSelect.value) {
    data = null;
  } else {
    data = await rpc("staff_list_gate_tickets", {
      p_event_id: eventSelect.value,
    });
  }
  renderDiscount();
  renderSell();
  renderReport();
  renderTable();
}

eventSelect.addEventListener("change", async () => {
  try {
    localStorage.setItem(EVENT_KEY, eventSelect.value);
  } catch (error) {
    /* ignore */
  }
  say("Loading...");
  try {
    await loadAll();
    say("");
  } catch (error) {
    say(friendlyError(error));
  }
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
  if (!can("gatetickets.manage")) {
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
  say("Loading...");
  try {
    await loadAll();
    say(events.length === 0 ? "There are no events yet." : "");
  } catch (loadError) {
    console.error("Load error:", loadError);
    say(friendlyError(loadError));
  }
}

start();
