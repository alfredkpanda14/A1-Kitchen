function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

const orderData = readStored("a1KitchenCurrentOrder");
const orderSummary = readStored("a1KitchenOrderSummary");

const orderNumber = document.getElementById("payment-order-number");
const paymentTotal = document.getElementById("payment-total");
const paymentMethod = document.getElementById("payment-method");
const paymentInstructions = document.getElementById("payment-instructions");
const paymentForm = document.getElementById("payment-form");
const paymentSummary = document.getElementById("payment-summary");
const copyButton = document.getElementById("copy-order-number");
const copyMessage = document.getElementById("copy-message");
const noOrder = document.getElementById("no-order");
const summarySection = document.getElementById("order-summary-section");
const methodSection = document.getElementById("payment-method-section");

function addLine(parent, text, bold) {
  const paragraph = document.createElement("p");

  if (bold) {
    const strong = document.createElement("strong");
    strong.textContent = text;
    paragraph.appendChild(strong);
  } else {
    paragraph.textContent = text;
  }

  parent.appendChild(paragraph);
}

function showSummary() {
  paymentSummary.textContent = "";

  if (!orderSummary || !Array.isArray(orderSummary.items)) {
    summarySection.hidden = true;
    return;
  }

  orderSummary.items.forEach((item) => {
    addLine(
      paymentSummary,
      item.quantity + " × " + item.name + " (NLe " + item.price + " each)",
    );
  });

  if (orderSummary.method === "delivery") {
    addLine(
      paymentSummary,
      "Delivery to: " + (orderSummary.location || ""),
      true,
    );
  } else {
    addLine(paymentSummary, "Pickup", true);
  }
}

if (!orderData) {
  orderNumber.textContent = "No current order found.";
  paymentTotal.textContent = "0";
  noOrder.hidden = false;
  copyButton.hidden = true;
  summarySection.hidden = true;
  methodSection.hidden = true;
} else {
  orderNumber.textContent = orderData.order_number;
  paymentTotal.textContent = orderData.total;
  showSummary();
}

async function copyOrderNumber() {
  const text = orderData.order_number;

  try {
    await navigator.clipboard.writeText(text);
    copyMessage.textContent = "Order number copied.";
  } catch (error) {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    document.body.appendChild(temporary);
    temporary.select();

    try {
      document.execCommand("copy");
      copyMessage.textContent = "Order number copied.";
    } catch (copyError) {
      copyMessage.textContent =
        "Could not copy. Please write down your order number.";
    }

    document.body.removeChild(temporary);
  }
}

copyButton.addEventListener("click", copyOrderNumber);

function showInstructions(method) {
  paymentInstructions.innerHTML = "";

  if (!method) {
    return;
  }

  let number = "";
  let accountName = "";

  if (method === "Orange Money") {
    number = SITE_INFO.orangeMoneyNumber;
    accountName = SITE_INFO.orangeMoneyName;
  } else if (method === "Afrimoney") {
    number = SITE_INFO.afrimoneyNumber;
    accountName = SITE_INFO.afrimoneyName;
  }

  const title = document.createElement("h3");
  title.textContent = method;
  paymentInstructions.appendChild(title);

  if (number) {
    addLineTo(
      paymentInstructions,
      "Send the exact total to this official A1 Kitchen number:",
    );
    addLineTo(paymentInstructions, number, true);

    if (accountName) {
      addLineTo(paymentInstructions, "Account name: " + accountName);
    }

    addLineTo(
      paymentInstructions,
      "Use your order number as the reference if possible.",
    );
    addLineTo(
      paymentInstructions,
      "After paying, take a screenshot of the payment confirmation and upload it on the next page.",
    );
  } else {
    addLineTo(
      paymentInstructions,
      "The official A1 Kitchen " +
        method +
        " number will be added here when supplied.",
      true,
    );

    if (SITE_INFO.phone) {
      addLineTo(
        paymentInstructions,
        "Please contact A1 Kitchen on " +
          SITE_INFO.phone +
          " for payment details.",
      );
    }
  }

  addLineTo(
    paymentInstructions,
    "Do not send payment to an unverified number.",
  );
  addLineTo(
    paymentInstructions,
    "A1 Kitchen will never ask for your PIN or password.",
  );
}

function addLineTo(parent, text, bold) {
  const paragraph = document.createElement("p");

  if (bold) {
    const strong = document.createElement("strong");
    strong.textContent = text;
    paragraph.appendChild(strong);
  } else {
    paragraph.textContent = text;
  }

  parent.appendChild(paragraph);
}

paymentMethod.addEventListener("change", () => {
  showInstructions(paymentMethod.value);
});

paymentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!paymentMethod.value) {
    alert("Please select Orange Money or Afrimoney.");
    return;
  }

  localStorage.setItem("a1KitchenPaymentMethod", paymentMethod.value);
  window.location.href = "payment-proof.html";
});
/* ---------- Tracking link ---------- */

const trackBox = document.getElementById("track-box");
const copyTrackButton = document.getElementById("copy-track-link");
const trackLink = document.getElementById("track-link");
const trackMessage = document.getElementById("track-message");

function buildTrackingUrl() {
  const number = localStorage.getItem("a1KitchenOrderNumber");
  const token = localStorage.getItem("a1KitchenCustomerToken");

  if (!number || !token) {
    return "";
  }

  return (
    new URL("track-order.html", window.location.href).href +
    "#o=" +
    encodeURIComponent(number) +
    "&t=" +
    encodeURIComponent(token)
  );
}

const trackingUrl = buildTrackingUrl();

if (!trackingUrl || !orderData) {
  trackBox.hidden = true;
} else {
  trackLink.href = trackingUrl;
}

copyTrackButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(trackingUrl);
    trackMessage.textContent = "Tracking link copied. Keep it private.";
  } catch (error) {
    trackMessage.textContent =
      "Could not copy. Use the Check order status button and bookmark that page.";
  }
});
