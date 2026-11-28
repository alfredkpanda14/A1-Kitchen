/* A1 Kitchen: Sales report page (Developer and Head Chef) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const presets = document.getElementById("report-presets");
const form = document.getElementById("report-form");
const fromInput = document.getElementById("report-from");
const toInput = document.getElementById("report-to");
const showButton = document.getElementById("report-show");
const pdfButton = document.getElementById("report-pdf");
const resultBox = document.getElementById("report-result");
const resultTitle = document.getElementById("report-title");
const tiles = document.getElementById("report-tiles");
const dishesBody = document.getElementById("report-dishes");
const signOutButton = document.getElementById("signout-button");

let staff = null;
let report = null;

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

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function longDate(text) {
  const date = new Date(text + "T00:00:00Z");
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function money(value) {
  return (
    "NLe " +
    Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })
  );
}

/* Freetown time is GMT, so "today" is the UTC date */
function today() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

const PRESETS = [
  [
    "This month",
    () => {
      const t = today();
      return [new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)), t];
    },
  ],
  [
    "Last month",
    () => {
      const t = today();
      const start = new Date(
        Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1),
      );
      const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return [start, end];
    },
  ],
  ["Last 7 days", () => [addDays(today(), -6), today()]],
  ["Last 30 days", () => [addDays(today(), -29), today()]],
  [
    "This year",
    () => {
      const t = today();
      return [new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), t];
    },
  ],
];

function buildPresets() {
  PRESETS.forEach(([label, range]) => {
    const button = el("button", "filter-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      const [start, end] = range();
      fromInput.value = iso(start);
      toInput.value = iso(end);
      presets.querySelectorAll(".filter-button").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
      loadReport();
    });
    button.setAttribute("aria-pressed", "false");
    presets.appendChild(button);
  });
}

function tile(label, value, note) {
  const card = el("div", "glance-card");
  card.appendChild(el("strong", null, value));
  card.appendChild(el("span", null, label));
  if (note) {
    card.appendChild(el("small", "glance-note", note));
  }
  return card;
}

function draw() {
  tiles.textContent = "";
  const rating = report.ratings || {};
  tiles.append(
    tile(
      "Total sales",
      money(report.revenue),
      "Food " + money(report.food_revenue),
    ),
    tile(
      "Paid orders",
      String(report.paid_orders),
      "of " + report.orders_placed + " placed",
    ),
    tile("Average order", money(report.average_order), null),
    tile("Delivery fees", money(report.delivery_fees), null),
    tile("Customers", String(report.customers), "different people who paid"),
    tile(
      "Customer rating",
      Number(rating.count) > 0
        ? Number(rating.average).toFixed(1) + " / 5"
        : "None yet",
      Number(rating.count) > 0 ? rating.count + " ratings" : null,
    ),
  );
  dishesBody.textContent = "";
  const dishes = report.top_dishes || [];
  if (dishes.length === 0) {
    const row = el("tr");
    const cell = el("td", null, "No dishes sold in these dates.");
    cell.colSpan = 3;
    row.appendChild(cell);
    dishesBody.appendChild(row);
  }
  dishes.forEach((dish) => {
    const row = el("tr");
    row.append(
      el("td", null, dish.name),
      el("td", null, String(dish.quantity)),
      el("td", null, money(dish.revenue)),
    );
    dishesBody.appendChild(row);
  });
  resultTitle.textContent =
    "Summary: " + longDate(report.from) + " to " + longDate(report.to);
  resultBox.hidden = false;
}

async function loadReport() {
  if (!fromInput.value || !toInput.value) {
    say("Please choose a start date and an end date.");
    return;
  }
  if (toInput.value < fromInput.value) {
    say("The end date must be on or after the start date.");
    return;
  }
  showButton.disabled = true;
  pdfButton.disabled = true;
  say("Working out the figures...");
  try {
    report = await rpc("staff_sales_report", {
      p_from: fromInput.value,
      p_to: toInput.value,
    });
    draw();
    pdfButton.disabled = false;
    say("");
  } catch (error) {
    say(friendlyError(error));
  }
  showButton.disabled = false;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  presets.querySelectorAll(".filter-button").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  loadReport();
});

pdfButton.addEventListener("click", async () => {
  if (!report) {
    return;
  }
  pdfButton.disabled = true;
  say("Preparing the PDF report...");
  try {
    await A1ReportPdf.download(
      report,
      "A1-Kitchen-Sales-Report-" + report.from + "-to-" + report.to + ".pdf",
    );
    say("Your PDF report has been downloaded.");
  } catch (error) {
    console.error("Report PDF error:", error);
    say("The PDF could not be made. Please try again.");
  }
  pdfButton.disabled = false;
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
  if (!can("reports.view")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    String(staff.role || "").replace(/_/g, " ") +
    ")";
  buildPresets();
  presets.querySelector(".filter-button").click();
}

start();
