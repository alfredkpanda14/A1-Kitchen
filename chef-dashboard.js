/* ---------- Page elements ---------- */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const lastUpdated = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const viewTabs = document.getElementById("view-tabs");
const ordersView = document.getElementById("orders-view");
const cateringView = document.getElementById("catering-view");
const eventsView = document.getElementById("events-view");
const orderTabs = document.getElementById("order-tabs");
const orderList = document.getElementById("order-list");
const cateringList = document.getElementById("catering-list");
const eventsList = document.getElementById("events-list");
const searchInput = document.getElementById("order-search");
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");

/* ---------- Status names (must match the database exactly) ---------- */
const PAY_AWAITING_QUOTE = "Awaiting Quote";
const PAY_PENDING = "Order Made — Payment Pending";
const PAY_SUBMITTED = "Payment Proof Submitted — Verification Pending";
const PAY_VERIFIED = "Payment Verified";
const PAY_REJECTED = "Payment Rejected";
const PAY_REVIEW = "Payment Needs Review";

const ST_PAID = "Paid — Not Delivered";
const ST_PREPARING = "Preparing";
const ST_OUT = "Out for Delivery";
const ST_READY = "Ready for Pickup";
const ST_DELIVERED = "Delivered — Customer Confirmation Pending";
const ST_CONFIRMED = "Delivered — Customer Confirmed";
const ST_CANCELLED = "Cancelled";

const CATERING_STATUSES = [
  "Pending",
  "Contacted",
  "Confirmed",
  "Declined",
  "Completed",
];

/* ---------- State ---------- */
let staff = null;
let orders = [];
let currentOrderTab = "needs-price";
let currentView = "orders";
let searchTimer = null;

const ORDER_TABS = [
  {
    id: "needs-price",
    label: "Needs price",
    test: (o) =>
      o.payment_status === PAY_AWAITING_QUOTE &&
      o.order_status !== ST_CANCELLED,
  },
  {
    id: "payments",
    label: "Payments to check",
    test: (o) =>
      (o.payment_status === PAY_SUBMITTED || o.payment_status === PAY_REVIEW) &&
      o.order_status !== ST_CANCELLED,
  },
  {
    id: "awaiting-payment",
    label: "Waiting for customer payment",
    test: (o) =>
      (o.payment_status === PAY_PENDING || o.payment_status === PAY_REJECTED) &&
      o.order_status !== ST_CANCELLED,
  },
  {
    id: "active",
    label: "In progress",
    test: (o) =>
      [ST_PAID, ST_PREPARING, ST_OUT, ST_READY].includes(o.order_status),
  },
  {
    id: "done",
    label: "Completed",
    test: (o) =>
      [ST_DELIVERED, ST_CONFIRMED, ST_CANCELLED].includes(o.order_status),
  },
  { id: "all", label: "All orders", test: () => true },
];

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

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function goToLogin() {
  window.location.href = "staff-login.html";
}

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }

  if (text.length > 0 && text.length < 140) {
    return text;
  }

  return "Something went wrong. Please try again.";
}

async function rpc(name, params) {
  const { data, error } = await supabaseClient.rpc(name, params || {});

  if (error) {
    if (error.code === "PGRST301" || /jwt/i.test(error.message || "")) {
      goToLogin();
    }

    throw new Error(error.message || "Request failed");
  }

  return data;
}

function badge(text, kind) {
  return el("span", "badge" + (kind ? " badge-" + kind : ""), text);
}

function paymentBadge(status) {
  if (status === PAY_VERIFIED) {
    return badge(status, "good");
  }

  if (status === PAY_REJECTED) {
    return badge(status, "bad");
  }

  if (
    status === PAY_AWAITING_QUOTE ||
    status === PAY_SUBMITTED ||
    status === PAY_REVIEW
  ) {
    return badge(status, "warn");
  }

  return badge(status);
}

/* ---------- Actions on an order ---------- */
async function runAction(button, work, doneMessage) {
  button.disabled = true;
  setMessage("Working...");

  try {
    await work();
    await loadOrders();
    setMessage(doneMessage);
  } catch (error) {
    console.error("Action failed:", error);
    setMessage(friendlyError(error));
    button.disabled = false;
  }
}

function quoteBox(order) {
  const box = el("div");
  box.appendChild(el("h4", null, "Send the price to the customer"));

  const foodField = el("div", "inline-field");
  const foodLabel = el("label", null, "Food total (NLe)");
  foodLabel.htmlFor = "food-" + order.id;
  const foodInput = el("input");
  foodInput.type = "number";
  foodInput.id = "food-" + order.id;
  foodInput.min = "1";
  foodInput.step = "0.01";
  foodInput.inputMode = "decimal";

  if (Number(order.subtotal) > 0) {
    foodInput.value = order.subtotal;
  }

  foodField.append(foodLabel, foodInput);

  const feeField = el("div", "inline-field");
  const feeLabel = el("label", null, "Delivery fee (NLe)");
  feeLabel.htmlFor = "fee-" + order.id;
  const feeInput = el("input");
  feeInput.type = "number";
  feeInput.id = "fee-" + order.id;
  feeInput.min = "0";
  feeInput.step = "0.01";
  feeInput.inputMode = "decimal";
  feeInput.value = order.delivery_method === "delivery" ? "" : "0";
  feeField.append(feeLabel, feeInput);

  const sendButton = el("button", "button", "Send price");
  sendButton.type = "button";

  sendButton.addEventListener("click", () => {
    const food = Number(foodInput.value);
    const fee = feeInput.value === "" ? NaN : Number(feeInput.value);

    if (!Number.isFinite(food) || food <= 0) {
      setMessage("Please enter the food total.");
      foodInput.focus();
      return;
    }

    if (!Number.isFinite(fee) || fee < 0) {
      setMessage("Please enter the delivery fee (0 if there is none).");
      feeInput.focus();
      return;
    }

    const message =
      "Send this price for order " +
      order.order_number +
      "?\n\nFood: " +
      money(food) +
      "\nDelivery: " +
      money(fee) +
      "\nTotal: " +
      money(food + fee);

    if (!window.confirm(message)) {
      return;
    }

    runAction(
      sendButton,
      () =>
        rpc("staff_send_quote", {
          p_order_id: order.id,
          p_subtotal: food,
          p_delivery_fee: fee,
        }),
      "Price sent for " + order.order_number + ". The customer can now pay.",
    );
  });

  box.append(foodField, feeField, el("br"), sendButton);
  return box;
}

async function showScreenshot(proof, holder, button, order) {
  if (holder.firstChild) {
    holder.textContent = "";
    button.textContent = "View screenshot";
    return;
  }

  button.disabled = true;

  try {
    const { data, error } = await supabaseClient.storage
      .from("payment-proof")
      .createSignedUrl(proof.path, 300);

    if (error || !data) {
      throw new Error("Could not open the screenshot.");
    }

    const link = el("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const image = el("img", "proof-image");
    image.src = data.signedUrl;
    image.alt = "Payment screenshot for order " + order.order_number;
    image.loading = "lazy";

    link.appendChild(image);
    holder.appendChild(link);
    button.textContent = "Hide screenshot";
  } catch (error) {
    console.error("Screenshot error:", error);
    setMessage(friendlyError(error));
  }

  button.disabled = false;
}

function paymentBox(order) {
  const box = el("div");
  box.appendChild(el("h4", null, "Check the payment"));
  box.appendChild(
    el(
      "p",
      null,
      "Expected: " +
        money(order.total) +
        (order.payment_method ? " by " + order.payment_method : ""),
    ),
  );

  if (!order.proofs || order.proofs.length === 0) {
    box.appendChild(
      el("p", null, "You do not have permission to view payment screenshots."),
    );
    return box;
  }

  order.proofs.forEach((proof) => {
    const row = el("div");
    row.appendChild(
      el(
        "p",
        null,
        "Screenshot sent " +
          formatDate(proof.created_at) +
          " (" +
          proof.status +
          ")",
      ),
    );

    const holder = el("div");
    const viewButton = el(
      "button",
      "button button-secondary",
      "View screenshot",
    );
    viewButton.type = "button";
    viewButton.addEventListener("click", () =>
      showScreenshot(proof, holder, viewButton, order),
    );
    row.append(viewButton, holder);

    if (can("payments.verify") && proof.status === "Verification Pending") {
      const verifyButton = el("button", "button", "Verify payment");
      verifyButton.type = "button";
      verifyButton.addEventListener("click", () => {
        const message =
          "Confirm that you have checked this payment for order " +
          order.order_number +
          " and that the full amount of " +
          money(order.total) +
          " was received?";

        if (!window.confirm(message)) {
          return;
        }

        runAction(
          verifyButton,
          () =>
            rpc("staff_verify_payment", {
              p_order_id: order.id,
              p_proof_id: proof.id,
            }),
          "Payment verified for " + order.order_number + ".",
        );
      });

      const rejectButton = el(
        "button",
        "button button-danger",
        "Reject screenshot",
      );
      rejectButton.type = "button";
      rejectButton.addEventListener("click", () => {
        const reason = window.prompt(
          "Why is this screenshot being rejected? (for your records)",
        );

        if (reason === null) {
          return;
        }

        runAction(
          rejectButton,
          () =>
            rpc("staff_reject_payment", {
              p_order_id: order.id,
              p_proof_id: proof.id,
              p_needs_review: false,
              p_reason: reason.trim() || null,
            }),
          "Screenshot rejected. The customer can upload a new one.",
        );
      });

      const reviewButton = el(
        "button",
        "button button-secondary",
        "Needs review",
      );
      reviewButton.type = "button";
      reviewButton.addEventListener("click", () => {
        runAction(
          reviewButton,
          () =>
            rpc("staff_reject_payment", {
              p_order_id: order.id,
              p_proof_id: proof.id,
              p_needs_review: true,
              p_reason: null,
            }),
          "Marked as needing review.",
        );
      });

      row.append(verifyButton, rejectButton, reviewButton);
    }

    box.appendChild(row);
  });

  return box;
}

function statusButtons(order) {
  const box = el("div");
  const status = order.order_status;
  const isDelivery = order.delivery_method === "delivery";
  let next = null;
  let label = "";

  if (status === ST_PAID && order.payment_status === PAY_VERIFIED) {
    next = ST_PREPARING;
    label = "Start preparing";
  } else if (status === ST_PREPARING) {
    next = isDelivery ? ST_OUT : ST_READY;
    label = isDelivery ? "Out for delivery" : "Ready for pickup";
  } else if (status === ST_OUT || status === ST_READY) {
    next = ST_DELIVERED;
    label = isDelivery ? "Mark delivered" : "Mark collected";
  }

  if (next) {
    const button = el("button", "button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      runAction(
        button,
        () =>
          rpc("staff_set_order_status", {
            p_order_id: order.id,
            p_new_status: next,
            p_reason: null,
          }),
        order.order_number + ": " + next + ".",
      );
    });
    box.appendChild(button);
  }

  return box;
}

function cancelButton(order) {
  const cancellable = [PAY_AWAITING_QUOTE, PAY_PENDING, ST_PAID].includes(
    order.order_status,
  );

  if (!cancellable) {
    return null;
  }

  const button = el("button", "button button-danger", "Cancel order");
  button.type = "button";
  button.addEventListener("click", () => {
    const paid = order.payment_status === PAY_VERIFIED;
    const intro = paid
      ? "This order has already been paid for. Cancel it only if the customer asked before preparation started, or the order cannot be supplied. You will need to refund the customer yourself.\n\n"
      : "";
    const reason = window.prompt(
      intro + "Why is order " + order.order_number + " being cancelled?",
    );

    if (reason === null) {
      return;
    }

    if (reason.trim().length < 3) {
      setMessage("Please give a reason for cancelling.");
      return;
    }

    runAction(
      button,
      () =>
        rpc("staff_set_order_status", {
          p_order_id: order.id,
          p_new_status: ST_CANCELLED,
          p_reason: reason.trim(),
        }),
      order.order_number + " has been cancelled.",
    );
  });

  return button;
}

/* ---------- Order cards ---------- */
function addDetail(parent, label, value) {
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function orderCard(order) {
  const card = el("div", "card order-card");

  card.appendChild(el("h3", null, order.order_number));

  const badges = el("p");
  badges.appendChild(paymentBadge(order.payment_status));
  badges.appendChild(badge(order.order_status));
  card.appendChild(badges);

  addDetail(card, "Ordered:", formatDate(order.created_at));

  const customer = el("p");
  customer.appendChild(el("strong", null, "Customer: "));
  customer.appendChild(document.createTextNode(order.customer_name + " — "));

  const phoneLink = el("a", null, order.customer_phone);
  phoneLink.href = "tel:" + order.customer_phone.replace(/[^\d+]/g, "");
  customer.appendChild(phoneLink);

  if (order.customer_whatsapp) {
    customer.appendChild(document.createTextNode(" — WhatsApp: "));
    const whatsappLink = el("a", null, order.customer_whatsapp);
    whatsappLink.href =
      "https://wa.me/" + order.customer_whatsapp.replace(/\D/g, "");
    whatsappLink.target = "_blank";
    whatsappLink.rel = "noopener noreferrer";
    customer.appendChild(whatsappLink);
  }

  card.appendChild(customer);

  if (order.delivery_method === "delivery") {
    addDetail(card, "Delivery to:", order.delivery_location || "");
  } else {
    addDetail(card, "Pickup", "");
  }

  if (order.delivery_notes) {
    addDetail(card, "Delivery notes:", order.delivery_notes);
  }

  if (order.order_notes) {
    addDetail(card, "Order notes:", order.order_notes);
  }

  card.appendChild(el("strong", null, "Food ordered:"));

  const list = el("ul");
  order.items.forEach((item) => {
    let text = item.quantity + " × " + item.name;

    if (item.unit_price !== null && item.unit_price !== undefined) {
      text += " (" + money(item.unit_price) + " each)";
    }

    list.appendChild(el("li", null, text));
  });
  card.appendChild(list);

  if (order.quote_required) {
    addDetail(card, "Price:", "not set yet");
  } else {
    addDetail(
      card,
      "Price:",
      "Food " +
        money(order.subtotal) +
        " + delivery " +
        money(order.delivery_fee) +
        " = " +
        money(order.total),
    );
  }

  if (order.customer_confirmed_at) {
    addDetail(
      card,
      "Customer confirmed delivery:",
      formatDate(order.customer_confirmed_at),
    );
  }

  if (order.problem_reported) {
    addDetail(card, "Problem reported:", order.problem_details || "yes");
  }

  const actions = el("div", "action-row");
  let hasActions = false;

  if (order.order_status !== ST_CANCELLED) {
    if (order.payment_status === PAY_AWAITING_QUOTE && can("orders.quote")) {
      actions.appendChild(quoteBox(order));
      hasActions = true;
    }

    if (
      (order.payment_status === PAY_SUBMITTED ||
        order.payment_status === PAY_REVIEW) &&
      can("payments.view")
    ) {
      actions.appendChild(paymentBox(order));
      hasActions = true;
    }

    if (order.payment_status === PAY_REJECTED) {
      actions.appendChild(
        el(
          "p",
          null,
          "Screenshot rejected. Waiting for the customer to send a new one.",
        ),
      );
      hasActions = true;
    }

    if (order.payment_status === PAY_PENDING) {
      actions.appendChild(
        el("p", null, "Price sent. Waiting for the customer to pay."),
      );
      hasActions = true;
    }

    if (can("orders.update_status")) {
      const buttons = statusButtons(order);

      if (buttons.firstChild) {
        actions.appendChild(buttons);
        hasActions = true;
      }

      const cancel = cancelButton(order);

      if (cancel) {
        actions.appendChild(cancel);
        hasActions = true;
      }
    }
  }

  if (hasActions) {
    card.appendChild(actions);
  }

  return card;
}

function renderOrderTabs() {
  orderTabs.textContent = "";

  ORDER_TABS.forEach((tab) => {
    const count = orders.filter(tab.test).length;
    const button = el(
      "button",
      "filter-button",
      tab.label + " (" + count + ")",
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(tab.id === currentOrderTab));

    button.addEventListener("click", () => {
      currentOrderTab = tab.id;
      renderOrders();
    });

    orderTabs.appendChild(button);
  });
}

function renderOrders() {
  renderOrderTabs();
  orderList.textContent = "";

  const tab =
    ORDER_TABS.find((item) => item.id === currentOrderTab) || ORDER_TABS[0];
  const visible = orders.filter(tab.test);

  if (visible.length === 0) {
    orderList.appendChild(el("p", null, "No orders here."));
    return;
  }

  visible.forEach((order) => orderList.appendChild(orderCard(order)));
}

async function loadOrders() {
  orders =
    (await rpc("staff_get_orders", {
      p_search: searchInput.value.trim(),
      p_limit: 200,
    })) || [];

  lastUpdated.textContent = "Last updated: " + formatDate(new Date());
  renderOrders();
}

/* ---------- Catering and events ---------- */
function renderCatering(rows) {
  cateringList.textContent = "";

  if (!rows || rows.length === 0) {
    cateringList.appendChild(el("p", null, "No catering requests yet."));
    return;
  }

  rows.forEach((row) => {
    const card = el("div", "card order-card");
    card.appendChild(el("h3", null, row.event_type));
    addDetail(card, "From:", row.full_name + " — " + row.phone);
    addDetail(card, "Received:", formatDate(row.created_at));

    if (row.event_date) {
      addDetail(card, "Event date:", row.event_date);
    }

    if (row.guest_count) {
      addDetail(card, "Guests:", String(row.guest_count));
    }

    if (row.location) {
      addDetail(card, "Location:", row.location);
    }

    if (row.details) {
      addDetail(card, "Details:", row.details);
    }

    if (can("catering.update")) {
      const select = el("select");
      select.id = "catering-" + row.id;

      CATERING_STATUSES.forEach((status) => {
        const option = el("option", null, status);
        option.value = status;
        option.selected = status === row.status;
        select.appendChild(option);
      });

      const label = el("label", null, "Status");
      label.htmlFor = select.id;

      const save = el("button", "button", "Save status");
      save.type = "button";
      save.addEventListener("click", async () => {
        save.disabled = true;

        try {
          await rpc("staff_update_catering", {
            p_id: row.id,
            p_status: select.value,
          });
          setMessage("Catering request updated.");
        } catch (error) {
          setMessage(friendlyError(error));
        }

        save.disabled = false;
      });

      card.append(label, select, save);
    } else {
      addDetail(card, "Status:", row.status);
    }

    cateringList.appendChild(card);
  });
}

async function loadCatering() {
  try {
    renderCatering(await rpc("staff_get_catering"));
  } catch (error) {
    setMessage(friendlyError(error));
  }
}

function renderEvents(rows) {
  eventsList.textContent = "";

  if (!rows || rows.length === 0) {
    eventsList.appendChild(
      el("p", null, "No Family Outing registrations yet."),
    );
    return;
  }

  const guests = rows.reduce((sum, row) => sum + Number(row.guests || 0), 0);
  eventsList.appendChild(
    el(
      "p",
      "menu-notice",
      rows.length + " registrations, " + guests + " guests in total.",
    ),
  );

  rows.forEach((row) => {
    const card = el("div", "card order-card");
    card.appendChild(el("h3", null, row.full_name));
    addDetail(card, "Phone:", row.phone);
    addDetail(card, "Guests:", String(row.guests));
    addDetail(card, "Year:", String(row.event_year));
    addDetail(card, "Registered:", formatDate(row.created_at));

    if (row.notes) {
      addDetail(card, "Notes:", row.notes);
    }

    eventsList.appendChild(card);
  });
}

async function loadEvents() {
  try {
    renderEvents(await rpc("staff_get_events", { p_year: null }));
  } catch (error) {
    setMessage(friendlyError(error));
  }
}

/* ---------- Views ---------- */
async function showView(name) {
  currentView = name;
  ordersView.hidden = name !== "orders";
  cateringView.hidden = name !== "catering";
  eventsView.hidden = name !== "events";

  viewTabs.querySelectorAll(".filter-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === name));
  });

  await refreshCurrentView();
}

function buildViewTabs() {
  const views = [
    { id: "orders", label: "Orders", allowed: can("orders.view") },
  ];

  views.push({
    id: "catering",
    label: "Catering requests",
    allowed: can("catering.view"),
  });
  views.push({
    id: "events",
    label: "Family Outing",
    allowed: can("events.view"),
  });

  views
    .filter((view) => view.allowed)
    .forEach((view) => {
      const button = el("button", "filter-button", view.label);
      button.type = "button";
      button.dataset.view = view.id;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => showView(view.id));
      viewTabs.appendChild(button);
    });
}

async function refreshCurrentView() {
  setMessage("Loading...");

  try {
    if (currentView === "orders") {
      await loadOrders();
    } else if (currentView === "catering") {
      await loadCatering();
    } else {
      await loadEvents();
    }

    setMessage("");
  } catch (error) {
    console.error("Load error:", error);
    setMessage(friendlyError(error));
  }
}

/* ---------- Account ---------- */
passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const first = document.getElementById("new-password").value;
  const second = document.getElementById("confirm-password").value;

  if (first.length < 12) {
    passwordMessage.textContent = "Please use at least 12 characters.";
    return;
  }

  if (first !== second) {
    passwordMessage.textContent = "The two passwords do not match.";
    return;
  }

  passwordMessage.textContent = "Saving...";

  const { error } = await supabaseClient.auth.updateUser({ password: first });

  if (error) {
    passwordMessage.textContent =
      "The password could not be changed. Please sign in again and retry.";
    return;
  }

  passwordForm.reset();
  passwordMessage.textContent = "Your password has been changed.";
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goToLogin();
});

refreshButton.addEventListener("click", refreshCurrentView);

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refreshCurrentView, 450);
});

/* ---------- Start ---------- */
async function start() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data || !data.session) {
    goToLogin();
    return;
  }

  const { data: info, error } = await supabaseClient.rpc("my_staff_info");

  if (error || !info) {
    await supabaseClient.auth.signOut();
    goToLogin();
    return;
  }

  staff = info;
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    staff.role.replace("_", " ") +
    ")";

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goToLogin();
    }
  });

  buildViewTabs();

  const first = viewTabs.querySelector(".filter-button");

  if (!first) {
    setMessage("Your account has no dashboard permissions yet.");
    return;
  }

  await showView(first.dataset.view);

  // Open on the first tab that has something waiting
  if (currentView === "orders") {
    const waiting = ORDER_TABS.slice(0, 4).find((tab) => orders.some(tab.test));

    if (waiting) {
      currentOrderTab = waiting.id;
      renderOrders();
    }
  }
}

start();
