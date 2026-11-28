/* A1 Kitchen: track an order, confirm delivery, rate it, report a problem */
const lookupSection = document.getElementById("lookup-section");
const resultSection = document.getElementById("result-section");
const orderCard = document.getElementById("order-card");
const trackMessage = document.getElementById("track-message");
const actionButton = document.getElementById("action-button");
const confirmButton = document.getElementById("confirm-button");
const refreshButton = document.getElementById("refresh-button");
const lookupForm = document.getElementById("lookup-form");
const problemSection = document.getElementById("problem-section");
const problemForm = document.getElementById("problem-form");
const problemMessage = document.getElementById("problem-message");
const problemNote = document.getElementById("problem-note");

const ORDER_PATTERN = /^A1-\d{8}-[A-Z0-9]{6}$/;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIRMABLE = [
  "Out for Delivery",
  "Ready for Pickup",
  "Delivered — Customer Confirmation Pending",
];

const RATED_STATUSES = [
  "Delivered — Customer Confirmation Pending",
  "Delivered — Customer Confirmed",
];

let currentOrderNumber = "";
let currentToken = "";
let currentOrder = null;

function setMessage(text) {
  trackMessage.textContent = text;
}

function describeStatus(order) {
  if (order.order_status === "Cancelled") {
    return {
      kind: "cancelled",
      title: "Order cancelled",
      text:
        "This order has been cancelled. Please contact A1 Kitchen if you " +
        "have any questions.",
    };
  }

  const payment = order.payment_status || "";

  if (order.quote_required || /awaiting quote/i.test(payment)) {
    return {
      kind: "quote",
      title: "Waiting for your price",
      text:
        "A1 Kitchen will contact you with your price and any delivery fee. " +
        "You can pay once your price is agreed. Your food is prepared only " +
        "after your payment is complete and confirmed.",
    };
  }

  if (/rejected/i.test(payment)) {
    return {
      kind: "rejected",
      title: "Screenshot not accepted",
      text:
        "We could not accept your payment screenshot. Please upload a clear " +
        "screenshot showing the completed payment, or contact A1 Kitchen.",
    };
  }

  if (/needs review/i.test(payment)) {
    return {
      kind: "review",
      title: "Payment under review",
      text:
        "A1 Kitchen needs to look at your payment a little more closely. " +
        "We may contact you if we need anything else.",
    };
  }

  if (/^payment verified/i.test(payment)) {
    return {
      kind: "verified",
      title: "Payment confirmed",
      text:
        "Thank you. Your payment has been confirmed and A1 Kitchen is " +
        "handling your order.",
    };
  }

  if (/proof submitted/i.test(payment)) {
    return {
      kind: "submitted",
      title: "Screenshot received",
      text:
        "A1 Kitchen is checking your payment screenshot. We will start " +
        "preparing your order once your payment is confirmed.",
    };
  }

  return {
    kind: "pending",
    title: "Waiting for your payment",
    text:
      "Please pay the full amount using Orange Money or Afrimoney, then " +
      "upload a screenshot of your payment. Your food is prepared after " +
      "your payment is confirmed. Orders that have been paid for cannot " +
      "be refunded.",
  };
}

function friendlyProgress(status) {
  const labels = {
    "Paid — Not Delivered": "Payment confirmed, preparation starting soon",
    Preparing: "Your food is being prepared",
    "Out for Delivery": "Out for delivery",
    "Ready for Pickup":
      "Ready for pickup. Please confirm the pickup address with A1 Kitchen before you collect your order.",
    "Delivered — Customer Confirmation Pending": "Delivered",
    "Delivered — Customer Confirmed": "Delivered and confirmed",
  };

  return labels[status] || status;
}

function addRow(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label + " ";
  paragraph.appendChild(strong);
  paragraph.appendChild(document.createTextNode(value));
  orderCard.appendChild(paragraph);
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

function renderOrder(order) {
  currentOrder = order;
  orderCard.textContent = "";

  const status = describeStatus(order);

  const title = document.createElement("h3");
  title.textContent = status.title;
  orderCard.appendChild(title);

  const text = document.createElement("p");
  text.textContent = status.text;
  orderCard.appendChild(text);

  addRow("Order number:", order.order_number);

  if (status.kind !== "quote") {
    const fee = Number(order.delivery_fee) || 0;

    if (fee > 0) {
      addRow("Food:", "NLe " + order.subtotal);
      addRow("Delivery fee:", "NLe " + fee);
    }

    addRow("Total:", "NLe " + order.total);
  }

  if (order.created_at) {
    addRow("Ordered:", formatDate(order.created_at));
  }

  if (order.delivery_method) {
    addRow(
      "Delivery or pickup:",
      order.delivery_method === "delivery" ? "Delivery" : "Pickup",
    );
  }

  if (order.payment_method) {
    addRow("Payment method:", order.payment_method);
  }

  if (status.kind === "verified" && order.order_status) {
    addRow("Order progress:", friendlyProgress(order.order_status));
  }

  if (order.customer_confirmed_at) {
    addRow("Delivery confirmed:", formatDate(order.customer_confirmed_at));
  }

  // Payment buttons
  if (status.kind === "pending" || status.kind === "rejected") {
    actionButton.hidden = false;
    actionButton.textContent =
      status.kind === "rejected"
        ? "Upload a new screenshot"
        : "Pay and upload screenshot";
  } else {
    actionButton.hidden = true;
  }

  // "I have received my order"
  const canConfirm =
    !order.customer_confirmed_at && CONFIRMABLE.includes(order.order_status);

  confirmButton.hidden = !canConfirm;
  confirmButton.textContent =
    order.delivery_method === "pickup"
      ? "I have collected my order"
      : "I have received my order";

  // Problem reporting is open once the order has been paid for
  const paid = status.kind === "verified" && order.order_status !== "Cancelled";

  problemSection.hidden = !paid;
  problemNote.textContent = order.problem_reported
    ? "You have already reported a problem. A1 Kitchen will contact you. You can send more details below."
    : "";

  lookupSection.hidden = true;
  resultSection.hidden = false;
  renderRating(order);
}

function showLookup() {
  resultSection.hidden = true;
  problemSection.hidden = true;
  ratingSection.hidden = true;
  lookupSection.hidden = false;
}

async function callRpc(name, params) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  let body = null;

  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    const message = (body && body.message) || "Request failed";
    throw new Error(message);
  }

  return body;
}

/* ---------- Star rating after delivery ---------- */

const ratingSection = document.createElement("section");
ratingSection.id = "rating-section";
ratingSection.className = "rating-section";
ratingSection.hidden = true;
resultSection.after(ratingSection);

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined && text !== null) {
    node.textContent = text;
  }
  return node;
}

function starRow(count) {
  const row = make("p", "rating-stars rating-stars-big");
  row.setAttribute("aria-label", count + " out of 5 stars");
  for (let i = 1; i <= 5; i += 1) {
    const star = make("span", i <= count ? "star-on" : "star-off", "★");
    star.setAttribute("aria-hidden", "true");
    row.appendChild(star);
  }
  return row;
}

function thankYou(order, stars, canChange) {
  ratingSection.textContent = "";
  ratingSection.appendChild(make("h2", null, "Thank You for Your Rating"));
  ratingSection.appendChild(starRow(stars));
  ratingSection.appendChild(
    make(
      "p",
      null,
      "You gave your order " +
        stars +
        (stars === 1 ? " star" : " stars") +
        ". Thank you for helping A1 Kitchen get better every day.",
    ),
  );
  if (canChange) {
    const change = make(
      "button",
      "button button-secondary",
      "Change my rating",
    );
    change.type = "button";
    change.addEventListener("click", () => ratingForm(order));
    ratingSection.appendChild(change);
  }
}

function ratingForm(order) {
  const previous = order.rating || null;
  let chosen = previous ? Number(previous.stars) : 0;
  ratingSection.textContent = "";
  ratingSection.appendChild(make("h2", null, "How Was Your Food?"));
  ratingSection.appendChild(
    make(
      "p",
      null,
      "Please rate your order. Tap the stars: 1 is poor, 5 is excellent.",
    ),
  );

  const form = make("form", "rating-form");
  form.noValidate = true;
  const group = make("div", "rate-stars");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Your rating");
  const labels = ["Poor", "Not good", "Okay", "Good", "Excellent"];
  const hint = make("p", "rate-hint", chosen ? labels[chosen - 1] : "");
  const buttons = [];
  function paint() {
    buttons.forEach((button, index) => {
      const on = index < chosen;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(index + 1 === chosen));
    });
    hint.textContent = chosen ? labels[chosen - 1] : "";
  }
  for (let i = 1; i <= 5; i += 1) {
    const button = make("button", "rate-star", "★");
    button.type = "button";
    button.setAttribute(
      "aria-label",
      i + (i === 1 ? " star" : " stars") + ": " + labels[i - 1],
    );
    button.addEventListener("click", () => {
      chosen = i;
      paint();
    });
    buttons.push(button);
    group.appendChild(button);
  }
  form.appendChild(group);
  form.appendChild(hint);

  const label = make("label", null, "Tell us more (optional)");
  label.htmlFor = "rating-comment";
  const comment = make("textarea");
  comment.id = "rating-comment";
  comment.rows = 3;
  comment.maxLength = 500;
  comment.placeholder = "What did you like? What could be better?";
  comment.value = (previous && previous.comment) || "";
  form.append(label, comment);
  form.appendChild(
    make(
      "p",
      "field-help",
      "If A1 Kitchen shares your rating on the website, only your first name is shown.",
    ),
  );
  const send = make(
    "button",
    "button",
    previous ? "Update my rating" : "Send my rating",
  );
  send.type = "submit";
  form.appendChild(send);
  const message = make("p", "success-message");
  message.setAttribute("role", "status");
  form.appendChild(message);
  paint();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!chosen) {
      message.textContent = "Please tap the stars to choose your rating.";
      return;
    }
    send.disabled = true;
    message.textContent = "Sending...";
    try {
      await callRpc("rate_order", {
        p_order_number: currentOrderNumber,
        p_customer_token: currentToken,
        p_stars: chosen,
        p_comment: comment.value.trim() || null,
      });
      order.rating = {
        stars: chosen,
        comment: comment.value.trim(),
        locked: false,
      };
      thankYou(order, chosen, true);
    } catch (error) {
      console.error("Rating error:", error);
      message.textContent =
        (error.message || "").length < 120 &&
        !/fetch/i.test(error.message || "")
          ? error.message
          : "We could not send your rating. Please try again.";
      send.disabled = false;
    }
  });
  ratingSection.appendChild(form);
}

function renderRating(order) {
  if (!RATED_STATUSES.includes(order.order_status)) {
    ratingSection.hidden = true;
    ratingSection.textContent = "";
    return;
  }
  ratingSection.hidden = false;
  if (order.rating) {
    thankYou(order, Number(order.rating.stars), !order.rating.locked);
  } else {
    ratingForm(order);
  }
}

function fetchOrderStatus(orderNumber, token) {
  return callRpc("get_order_status", {
    p_order_number: orderNumber,
    p_customer_token: token,
  });
}

async function loadOrder(orderNumber, token) {
  currentOrderNumber = orderNumber;
  currentToken = token;
  setMessage("Checking your order...");

  try {
    const order = await fetchOrderStatus(orderNumber, token);
    setMessage("");
    renderOrder(order);
  } catch (error) {
    console.error("Order lookup error:", error);

    if ((error.message || "").includes("Order not found")) {
      setMessage(
        "We could not find that order. Please check your tracking link, " +
          "order number and confirmation code.",
      );
    } else {
      setMessage(
        "We could not check your order right now. Please check your " +
          "internet connection and try again.",
      );
    }

    showLookup();
  }
}

actionButton.addEventListener("click", () => {
  if (!currentOrder) {
    return;
  }

  localStorage.setItem("a1KitchenOrderNumber", currentOrder.order_number);
  localStorage.setItem("a1KitchenCustomerToken", currentToken);
  localStorage.setItem(
    "a1KitchenCurrentOrder",
    JSON.stringify({
      order_number: currentOrder.order_number,
      total: currentOrder.total,
    }),
  );
  localStorage.removeItem("a1KitchenOrderSummary");

  window.location.href = "payment.html";
});

confirmButton.addEventListener("click", async () => {
  if (!currentOrder) {
    return;
  }

  confirmButton.disabled = true;
  setMessage("Saving...");

  try {
    await callRpc("confirm_delivery", {
      p_order_number: currentOrderNumber,
      p_customer_token: currentToken,
    });

    await loadOrder(currentOrderNumber, currentToken);
    setMessage("Thank you! We have recorded that you received your order.");
  } catch (error) {
    console.error("Confirm error:", error);
    setMessage(
      "We could not save your confirmation. Please try again, or contact A1 Kitchen.",
    );
  }

  confirmButton.disabled = false;
});

problemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const details = document.getElementById("problem-details").value.trim();

  if (details.length < 5) {
    problemMessage.textContent = "Please describe the problem in a few words.";
    return;
  }

  const submitButton = problemForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  problemMessage.textContent = "Sending...";

  try {
    await callRpc("report_problem", {
      p_order_number: currentOrderNumber,
      p_customer_token: currentToken,
      p_details: details,
    });

    problemForm.reset();
    problemMessage.textContent =
      "Thank you. A1 Kitchen has received your report and will contact you.";
    await loadOrder(currentOrderNumber, currentToken);
  } catch (error) {
    console.error("Problem report error:", error);

    if ((error.message || "").includes("Too many")) {
      problemMessage.textContent =
        "You have sent several reports already. Please contact A1 Kitchen directly.";
    } else {
      problemMessage.textContent =
        "We could not send your report. Please try again, or contact A1 Kitchen.";
    }
  }

  submitButton.disabled = false;
});

refreshButton.addEventListener("click", () => {
  if (currentOrderNumber && currentToken) {
    loadOrder(currentOrderNumber, currentToken);
  }
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const orderNumber = document
    .getElementById("lookup-order")
    .value.trim()
    .toUpperCase();
  const token = document
    .getElementById("lookup-token")
    .value.trim()
    .toLowerCase();

  if (!ORDER_PATTERN.test(orderNumber)) {
    setMessage(
      "Please check your order number. It looks like A1-20261007-ABC123.",
    );
    return;
  }

  if (!TOKEN_PATTERN.test(token)) {
    setMessage("Please check your confirmation code.");
    return;
  }

  loadOrder(orderNumber, token);
});

function start() {
  // The secret code sits after the # in the link, so browsers never send it
  // to any server.
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const orderNumber = (
    params.get("o") ||
    localStorage.getItem("a1KitchenOrderNumber") ||
    ""
  ).trim();
  const token = (
    params.get("t") ||
    localStorage.getItem("a1KitchenCustomerToken") ||
    ""
  ).trim();

  if (ORDER_PATTERN.test(orderNumber) && TOKEN_PATTERN.test(token)) {
    loadOrder(orderNumber, token);
  } else {
    showLookup();
  }
}

start();
