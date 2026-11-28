/* A1 Kitchen: Customer ratings (Developer, Head Chef, Manager) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const summary = document.getElementById("rating-summary");
const tabs = document.getElementById("rating-tabs");
const list = document.getElementById("rating-list");
const signOutButton = document.getElementById("signout-button");

const TABS = [
  ["Pending", "Waiting"],
  ["Approved", "On the home page"],
  ["Hidden", "Hidden"],
  ["", "All"],
];

let staff = null;
let currentTab = "Pending";

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

function stamp(value) {
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

function stars(count) {
  const box = el("span", "rating-stars");
  box.setAttribute("aria-label", count + " out of 5 stars");
  for (let i = 1; i <= 5; i += 1) {
    const star = el("span", i <= count ? "star-on" : "star-off", "★");
    star.setAttribute("aria-hidden", "true");
    box.appendChild(star);
  }
  return box;
}

function drawTabs() {
  tabs.textContent = "";
  TABS.forEach(([value, label]) => {
    const button = el("button", "filter-button", label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(value === currentTab));
    button.addEventListener("click", () => {
      currentTab = value;
      drawTabs();
      load();
    });
    tabs.appendChild(button);
  });
}

async function setStatus(rating, status, button) {
  button.disabled = true;
  try {
    await rpc("staff_set_rating_status", { p_id: rating.id, p_status: status });
    say(
      status === "Approved"
        ? "Approved. It now shows on the home page."
        : status === "Hidden"
          ? "Hidden. It will not show on the home page."
          : "Moved back to waiting.",
    );
    await load();
  } catch (error) {
    button.disabled = false;
    say(friendlyError(error));
  }
}

function card(rating) {
  const low = Number(rating.stars) <= 2;
  const box = el("article", "rating-card" + (low ? " is-low" : ""));
  const top = el("div", "rating-card-top");
  top.appendChild(stars(Number(rating.stars)));
  const status = el(
    "span",
    "badge " +
      (rating.status === "Approved"
        ? "badge-good"
        : rating.status === "Hidden"
          ? "badge-bad"
          : "badge-warn"),
    rating.status === "Pending" ? "Waiting" : rating.status,
  );
  top.appendChild(status);
  if (low) {
    top.appendChild(el("span", "badge badge-bad", "Low rating: please call"));
  }
  box.appendChild(top);
  box.appendChild(
    el(
      "p",
      "rating-comment",
      rating.comment ? "“" + rating.comment + "”" : "(No comment)",
    ),
  );
  const who = el("p", "rating-who");
  who.appendChild(
    document.createTextNode(
      "Shown as: " +
        (rating.display_name || "A happy customer") +
        "  ·  Customer: " +
        rating.customer_name +
        " — ",
    ),
  );
  const phone = el("a", null, rating.customer_phone);
  phone.href =
    "tel:" + String(rating.customer_phone || "").replace(/[^\d+]/g, "");
  who.appendChild(phone);
  box.appendChild(who);
  box.appendChild(
    el(
      "p",
      "field-help",
      "Order " +
        rating.order_number +
        "  ·  " +
        stamp(rating.created_at) +
        (rating.decided_by ? "  ·  Decided by " + rating.decided_by : ""),
    ),
  );
  const buttons = el("div", "help-buttons");
  if (rating.status !== "Approved") {
    const approve = el("button", "button", "Approve (show on home page)");
    approve.type = "button";
    approve.addEventListener("click", () =>
      setStatus(rating, "Approved", approve),
    );
    buttons.appendChild(approve);
  }
  if (rating.status !== "Hidden") {
    const hide = el("button", "button button-secondary", "Hide");
    hide.type = "button";
    hide.addEventListener("click", () => setStatus(rating, "Hidden", hide));
    buttons.appendChild(hide);
  }
  if (rating.status !== "Pending") {
    const back = el("button", "button button-secondary", "Back to waiting");
    back.type = "button";
    back.addEventListener("click", () => setStatus(rating, "Pending", back));
    buttons.appendChild(back);
  }
  box.appendChild(buttons);
  return box;
}

async function load() {
  list.textContent = "";
  const data = await rpc("staff_list_ratings", { p_status: currentTab });
  summary.textContent =
    Number(data.total) === 0
      ? "No ratings yet."
      : "Average " +
        Number(data.average).toFixed(1) +
        " out of 5 from " +
        data.total +
        (Number(data.total) === 1 ? " rating" : " ratings") +
        ". " +
        data.pending +
        " waiting" +
        (Number(data.low_pending) > 0 ? ", " + data.low_pending + " low" : "") +
        ".";
  const items = data.items || [];
  if (items.length === 0) {
    list.appendChild(el("p", "guide-empty", "Nothing here."));
    return;
  }
  items.forEach((rating) => list.appendChild(card(rating)));
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
  if (!can("ratings.manage")) {
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
  drawTabs();
  try {
    await load();
  } catch (error) {
    say(friendlyError(error));
  }
}

start();
