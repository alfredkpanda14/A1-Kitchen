/* ---------- Page elements ---------- */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const summaryBox = document.getElementById("summary-box");
const staffSection = document.getElementById("staff-section");
const staffList = document.getElementById("staff-list");
const pendingList = document.getElementById("pending-list");
const auditSection = document.getElementById("audit-section");
const auditBody = document.getElementById("audit-body");

const ROLES = [
  "developer",
  "head_chef",
  "manager",
  "senior_staff",
  "junior_staff",
];

let staff = null;
let myId = "";

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

function setMessage(text) {
  dashMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function money(value) {
  return "NLe " + Number(value || 0);
}

function roleName(role) {
  return String(role || "").replace("_", " ");
}

function formatDate(value) {
  if (!value) {
    return "never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function goTo(page) {
  window.location.href = page;
}

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }

  if (text.length > 0 && text.length < 160) {
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

async function runAction(button, work, doneMessage) {
  button.disabled = true;
  setMessage("Working...");

  try {
    await work();
    await loadAll();
    setMessage(doneMessage);
  } catch (error) {
    console.error("Action failed:", error);
    setMessage(friendlyError(error));
    button.disabled = false;
  }
}

/* ---------- Overview ---------- */
function statCard(label, value) {
  const card = el("div", "card");
  card.appendChild(el("p", "order-number", String(value)));
  card.appendChild(el("p", null, label));
  return card;
}

function renderSummary(data) {
  summaryBox.textContent = "";

  const grid = el("div", "card-container");
  grid.appendChild(statCard("Orders today", data.orders_today));
  grid.appendChild(statCard("Orders waiting for a price", data.needs_price));
  grid.appendChild(statCard("Payments to check", data.payments_to_check));
  grid.appendChild(statCard("Orders in progress", data.in_progress));
  grid.appendChild(statCard("Completed orders", data.completed));
  grid.appendChild(statCard("Cancelled orders", data.cancelled));
  grid.appendChild(statCard("All orders ever", data.orders_total));
  grid.appendChild(statCard("Customers", data.customers));
  grid.appendChild(
    statCard("Pending catering requests", data.catering_pending),
  );
  grid.appendChild(
    statCard("Family Outing registrations", data.event_registrations),
  );
  summaryBox.appendChild(grid);

  summaryBox.appendChild(el("h3", null, "Verified payments (by order date)"));
  const money_grid = el("div", "card-container");
  money_grid.appendChild(statCard("Today", money(data.paid_today)));
  money_grid.appendChild(statCard("Last 7 days", money(data.paid_7_days)));
  money_grid.appendChild(statCard("This month", money(data.paid_month)));
  summaryBox.appendChild(money_grid);
}

/* ---------- Staff ---------- */
function roleSelect(id, current) {
  const select = el("select");
  select.id = id;

  ROLES.forEach((role) => {
    const option = el("option", null, roleName(role));
    option.value = role;
    option.selected = role === current;
    select.appendChild(option);
  });

  return select;
}

function addLine(parent, label, value) {
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function staffCard(person) {
  const card = el("div", "card order-card");
  const isMe = person.user_id === myId;

  card.appendChild(el("h3", null, person.full_name + (isMe ? " (you)" : "")));

  const badges = el("p");
  badges.appendChild(el("span", "badge", roleName(person.role)));
  badges.appendChild(
    el(
      "span",
      "badge " + (person.active ? "badge-good" : "badge-bad"),
      person.active ? "Active" : "Blocked",
    ),
  );
  card.appendChild(badges);

  addLine(card, "Email:", person.email || "");
  addLine(card, "Last signed in:", formatDate(person.last_sign_in_at));

  if (isMe) {
    return card;
  }

  const actions = el("div", "action-row");

  const select = roleSelect("role-" + person.user_id, person.role);
  const label = el("label", null, "Role");
  label.htmlFor = select.id;

  const saveRole = el("button", "button", "Save role");
  saveRole.type = "button";
  saveRole.addEventListener("click", () => {
    if (select.value === person.role) {
      setMessage("That is already their role.");
      return;
    }

    if (
      !window.confirm(
        "Change " + person.full_name + " to " + roleName(select.value) + "?",
      )
    ) {
      return;
    }

    runAction(
      saveRole,
      () =>
        rpc("staff_set_role", {
          p_user_id: person.user_id,
          p_role: select.value,
        }),
      person.full_name + " is now " + roleName(select.value) + ".",
    );
  });

  actions.append(label, select, saveRole, el("br"));

  const blockButton = el(
    "button",
    person.active ? "button button-danger" : "button",
    person.active ? "Block access" : "Unblock",
  );
  blockButton.type = "button";
  blockButton.addEventListener("click", () => {
    const question = person.active
      ? "Block " +
        person.full_name +
        "? They will be signed out and cannot use the dashboard."
      : "Unblock " + person.full_name + "? They will be able to sign in again.";

    if (!window.confirm(question)) {
      return;
    }

    runAction(
      blockButton,
      () =>
        rpc("staff_set_active", {
          p_user_id: person.user_id,
          p_active: !person.active,
        }),
      person.full_name +
        (person.active ? " has been blocked." : " has been unblocked."),
    );
  });

  const deleteButton = el(
    "button",
    "button button-secondary",
    "Delete account",
  );
  deleteButton.type = "button";
  deleteButton.addEventListener("click", () => {
    const typed = window.prompt(
      "This permanently deletes " +
        person.full_name +
        "'s account. Their past actions stay in the activity log.\n\nType DELETE to confirm.",
    );

    if (typed !== "DELETE") {
      return;
    }

    runAction(
      deleteButton,
      () => rpc("staff_delete", { p_user_id: person.user_id }),
      person.full_name + "'s account has been deleted.",
    );
  });

  actions.append(blockButton, deleteButton);
  card.appendChild(actions);
  return card;
}

function pendingCard(account) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, account.email || "(no email)"));
  addLine(card, "Account created:", formatDate(account.created_at));

  const nameField = el("div", "inline-field");
  const nameLabel = el("label", null, "Full name");
  nameLabel.htmlFor = "grant-name-" + account.user_id;
  const nameInput = el("input");
  nameInput.id = "grant-name-" + account.user_id;
  nameInput.type = "text";
  nameInput.maxLength = 100;
  nameInput.autocomplete = "off";
  nameField.append(nameLabel, nameInput);

  const roleField = el("div", "inline-field");
  const roleLabel = el("label", null, "Role");
  const select = roleSelect("grant-role-" + account.user_id, "junior_staff");
  roleLabel.htmlFor = select.id;
  roleField.append(roleLabel, select);

  const grant = el("button", "button", "Grant access");
  grant.type = "button";
  grant.addEventListener("click", () => {
    const name = nameInput.value.trim();

    if (name.length < 2) {
      setMessage("Please enter the person's full name.");
      nameInput.focus();
      return;
    }

    const question =
      "Give " +
      name +
      " (" +
      account.email +
      ") access as " +
      roleName(select.value) +
      "?";

    if (!window.confirm(question)) {
      return;
    }

    runAction(
      grant,
      () =>
        rpc("staff_grant_access", {
          p_user_id: account.user_id,
          p_full_name: name,
          p_role: select.value,
        }),
      name + " now has access as " + roleName(select.value) + ".",
    );
  });

  card.append(nameField, roleField, el("br"), grant);
  return card;
}

async function loadStaff() {
  const [people, pending] = await Promise.all([
    rpc("staff_list"),
    rpc("staff_list_pending"),
  ]);

  staffList.textContent = "";
  (people || []).forEach((person) => staffList.appendChild(staffCard(person)));

  pendingList.textContent = "";

  if (!pending || pending.length === 0) {
    pendingList.appendChild(
      el("p", null, "No accounts are waiting for approval."),
    );
    return;
  }

  pending.forEach((account) => pendingList.appendChild(pendingCard(account)));
}

/* ---------- Activity log ---------- */
function describe(row) {
  if (!row.details) {
    return "";
  }

  const text = JSON.stringify(row.details);
  return text.length > 160 ? text.slice(0, 157) + "..." : text;
}

function renderAudit(rows) {
  auditBody.textContent = "";

  if (!rows || rows.length === 0) {
    const tr = el("tr");
    const td = el("td", null, "No activity yet.");
    td.colSpan = 5;
    tr.appendChild(td);
    auditBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = el("tr");
    tr.appendChild(el("td", null, formatDate(row.created_at)));
    tr.appendChild(el("td", null, row.actor_name || "(unknown)"));
    tr.appendChild(el("td", null, String(row.action).replace(/_/g, " ")));
    tr.appendChild(el("td", null, row.target_id || ""));
    tr.appendChild(el("td", null, describe(row)));
    auditBody.appendChild(tr);
  });
}

/* ---------- Loading ---------- */
async function loadAll() {
  if (can("reports.view")) {
    renderSummary(await rpc("staff_dashboard_summary"));
  }

  if (can("staff.manage")) {
    await loadStaff();
  }

  if (can("audit.view")) {
    renderAudit(await rpc("staff_get_audit", { p_limit: 100 }));
  }
}

async function refresh() {
  setMessage("Loading...");

  try {
    await loadAll();
    setMessage("");
  } catch (error) {
    console.error("Load error:", error);
    setMessage(friendlyError(error));
  }
}

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

refreshButton.addEventListener("click", refresh);

/* ---------- Start ---------- */
async function start() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data || !data.session) {
    goTo("staff-login.html");
    return;
  }

  myId = data.session.user.id;

  const { data: info, error } = await supabaseClient.rpc("my_staff_info");

  if (error || !info) {
    await supabaseClient.auth.signOut();
    goTo("staff-login.html");
    return;
  }

  staff = info;
  document.getElementById("nav-menu").hidden = !can("menu.manage");
  document.getElementById("nav-events").hidden = !can("events.view");
  if (!can("staff.manage")) {
    // This page is for the Developer role only
    goTo("chef-dashboard.html");
    return;
  }

  welcome.textContent =
    "Signed in as " + staff.full_name + " (" + roleName(staff.role) + ")";

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goTo("staff-login.html");
    }
  });

  staffSection.hidden = false;
  auditSection.hidden = !can("audit.view");
  await refresh();
}

start();
