const lookupSection = document.getElementById("lookup-section");
const resultSection = document.getElementById("result-section");
const orderCard = document.getElementById("order-card");
const trackMessage = document.getElementById("track-message");
const actionButton = document.getElementById("action-button");
const refreshButton = document.getElementById("refresh-button");
const lookupForm = document.getElementById("lookup-form");

const ORDER_PATTERN = /^A1-\d{8}-[A-Z0-9]{6}$/;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    "Ready for Pickup": "Ready for pickup",
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

  if (status.kind === "pending" || status.kind === "rejected") {
    actionButton.hidden = false;
    actionButton.textContent =
      status.kind === "rejected"
        ? "Upload a new screenshot"
        : "Pay and upload screenshot";
  } else {
    actionButton.hidden = true;
  }

  lookupSection.hidden = true;
  resultSection.hidden = false;
}

function showLookup() {
  resultSection.hidden = true;
  lookupSection.hidden = false;
}

async function fetchOrderStatus(orderNumber, token) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_order_status", {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      p_order_number: orderNumber,
      p_customer_token: token,
    }),
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
