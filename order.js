const orderForm = document.getElementById("order-form");
const orderSummary = document.getElementById("order-summary");
const orderTotal = document.getElementById("order-total");
const orderMessage = document.getElementById("order-message");
const deliveryMethod = document.getElementById("delivery-method");
const deliveryLocationContainer = document.getElementById(
  "delivery-location-container",
);
const deliveryLocation = document.getElementById("delivery-location");
const submitButton = orderForm.querySelector('button[type="submit"]');
const whatsappSection = document.getElementById("whatsapp-order");
const whatsappLink = document.getElementById("whatsapp-order-link");

const MAX_PER_ITEM = 20;

let cart = [];
let isSubmitting = false;

/* A short note above the button explaining what happens next */
const quoteNote = document.createElement("p");
quoteNote.className = "menu-notice";
orderForm.insertBefore(quoteNote, submitButton);

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];

    return saved
      .filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          (toPrice(item.price) !== null ||
            item.price === null ||
            item.price === undefined) &&
          Number.isInteger(Number(item.quantity)) &&
          Number(item.quantity) >= 1 &&
          Number(item.quantity) <= MAX_PER_ITEM,
      )
      .map((item) => ({
        name: item.name,
        price: toPrice(item.price),
        quantity: Number(item.quantity),
      }));
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("a1KitchenCart", JSON.stringify(cart));
}

function setMessage(text) {
  orderMessage.textContent = text;
}

function hasUnpricedItems() {
  return cart.some((item) => toPrice(item.price) === null);
}

function cartTotal() {
  return cart.reduce(
    (sum, item) => sum + toPrice(item.price) * Number(item.quantity),
    0,
  );
}

/* ---------- Notes and button label ---------- */

function updateQuoteInfo() {
  const unpriced = hasUnpricedItems();
  const isDelivery = deliveryMethod.value === "delivery";

  if (unpriced) {
    quoteNote.textContent =
      "Prices are confirmed by A1 Kitchen. After you send your order, we " +
      "will contact you with your price and any delivery fee. You pay only " +
      "after you agree.";
    quoteNote.hidden = false;
    submitButton.textContent = "Send My Order";
  } else if (isDelivery) {
    quoteNote.textContent =
      "A1 Kitchen will add your delivery fee, which depends on your " +
      "location, and then you can pay.";
    quoteNote.hidden = false;
    submitButton.textContent = "Send My Order";
  } else {
    quoteNote.textContent = "";
    quoteNote.hidden = true;
    submitButton.textContent = "Continue to Payment";
  }
}

/* ---------- WhatsApp fallback ---------- */

function whatsappNumber() {
  if (typeof SITE_INFO === "undefined" || !SITE_INFO.whatsapp) {
    return "";
  }

  return SITE_INFO.whatsapp.replace(/\D/g, "");
}

function buildWhatsAppMessage() {
  const priced = !hasUnpricedItems();
  const lines = ["Hello A1 Kitchen, I would like to order:"];

  cart.forEach((item) => {
    lines.push(
      "- " +
        item.quantity +
        " × " +
        item.name +
        (priced ? " (NLe " + toPrice(item.price) + " each)" : ""),
    );
  });

  if (priced) {
    lines.push("Total: NLe " + cartTotal());
  }

  const nameValue = document.getElementById("customer-name").value.trim();
  const phoneValue = document.getElementById("phone").value.trim();
  const methodValue = deliveryMethod.value;
  const locationValue = deliveryLocation.value.trim();
  const notesValue = document.getElementById("order-notes").value.trim();

  if (nameValue) {
    lines.push("Name: " + nameValue);
  }

  if (phoneValue) {
    lines.push("Phone: " + phoneValue);
  }

  if (methodValue === "delivery") {
    lines.push("Delivery" + (locationValue ? " to: " + locationValue : ""));
  } else if (methodValue === "pickup") {
    lines.push("Pickup");
  }

  if (notesValue) {
    lines.push("Notes: " + notesValue);
  }

  return lines.join("\n");
}

function updateWhatsAppLink() {
  const number = whatsappNumber();

  if (!number || cart.length === 0) {
    whatsappSection.hidden = true;
    return;
  }

  whatsappSection.hidden = false;
  whatsappLink.href =
    "https://wa.me/" +
    number +
    "?text=" +
    encodeURIComponent(buildWhatsAppMessage());
}

/* ---------- Order summary ---------- */

function displayOrder() {
  orderSummary.textContent = "";

  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.textContent =
      "Your order is empty. Please return to the menu and add food first.";
    orderSummary.appendChild(empty);
    orderTotal.textContent = "0";
    orderTotal.parentElement.hidden = false;
    updateQuoteInfo();
    updateWhatsAppLink();
    return;
  }

  cart.forEach((item) => {
    const price = toPrice(item.price);

    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const line = document.createElement("p");

    if (price === null) {
      line.textContent = "Quantity: " + item.quantity;
    } else {
      line.textContent =
        item.quantity + " × NLe " + price + " = NLe " + price * item.quantity;
    }

    info.append(name, line);
    row.appendChild(info);
    orderSummary.appendChild(row);
  });

  const unpriced = hasUnpricedItems();
  orderTotal.parentElement.hidden = unpriced;

  if (!unpriced) {
    orderTotal.textContent = cartTotal();
  }

  updateQuoteInfo();
  updateWhatsAppLink();
}

/* Check the live menu so the customer sees today's prices */
async function refreshPrices() {
  if (cart.length === 0) {
    return;
  }

  try {
    const menu = await fetchAvailableMenu();
    const result = syncCartWithMenu(cart, menu);

    cart = result.cart;
    saveCart();
    displayOrder();

    if (result.messages.length > 0) {
      setMessage(result.messages.join(" "));
    }
  } catch (error) {
    console.error("Could not refresh prices:", error);
    // The server always works out the final price, so we can carry on
  }
}

/* ---------- Form ---------- */

function updateDeliveryFields() {
  const isDelivery = deliveryMethod.value === "delivery";

  deliveryLocationContainer.hidden = !isDelivery;
  deliveryLocation.required = isDelivery;

  if (!isDelivery) {
    deliveryLocation.value = "";
  }

  updateQuoteInfo();
}

function isValidPhone(value) {
  if (!/^\+?[0-9\s\-()]+$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function showProblem(message, field) {
  setMessage(message);

  if (field) {
    field.focus();
  }
}

function friendlyOrderError(error) {
  const text = (error && error.message) || "";

  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return (
      "We could not reach A1 Kitchen. Please check your internet " +
      "connection and try again."
    );
  }

  if (text.includes("Food item is unavailable")) {
    const foodName = text.split("unavailable:")[1];
    return (
      "Sorry, " +
      (foodName ? foodName.trim() : "a food in your order") +
      " is no longer available. Please go back to the menu and review your order."
    );
  }

  return (
    "Something went wrong while saving your order. Please try again, " +
    "or contact A1 Kitchen if it keeps happening."
  );
}

deliveryMethod.addEventListener("change", updateDeliveryFields);
orderForm.addEventListener("input", updateWhatsAppLink);
orderForm.addEventListener("change", updateWhatsAppLink);

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  if (cart.length === 0) {
    showProblem("Your order is empty. Please return to the menu.");
    return;
  }

  const customerNameField = document.getElementById("customer-name");
  const phoneField = document.getElementById("phone");
  const whatsappField = document.getElementById("whatsapp");

  const customerName = customerNameField.value.trim();
  const phone = phoneField.value.trim();
  const whatsapp = whatsappField.value.trim();
  const method = deliveryMethod.value;
  const location = deliveryLocation.value.trim();
  const deliveryNotes = document.getElementById("delivery-notes").value.trim();
  const orderNotes = document.getElementById("order-notes").value.trim();

  if (customerName.length < 2) {
    showProblem("Please enter your full name.", customerNameField);
    return;
  }

  if (!isValidPhone(phone)) {
    showProblem(
      "Please enter a valid phone number, for example +232 79 123456.",
      phoneField,
    );
    return;
  }

  if (whatsapp !== "" && !isValidPhone(whatsapp)) {
    showProblem(
      "Please enter a valid WhatsApp number, or leave it empty.",
      whatsappField,
    );
    return;
  }

  if (method !== "delivery" && method !== "pickup") {
    showProblem("Please choose delivery or pickup.", deliveryMethod);
    return;
  }

  if (method === "delivery" && location.length < 5) {
    showProblem(
      "Please enter your delivery location so we can find you.",
      deliveryLocation,
    );
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;
  setMessage("Submitting your order...");

  const { data, error } = await supabaseClient.rpc("create_a1_order", {
    p_full_name: customerName,
    p_phone: phone,
    p_whatsapp: whatsapp || null,
    p_delivery_method: method,
    p_delivery_location: location || null,
    p_delivery_notes: deliveryNotes || null,
    p_order_notes: orderNotes || null,
    p_items: cart.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
    })),
  });

  if (error) {
    console.error("A1 Kitchen order submission error:", error);
    setMessage(friendlyOrderError(error));
    isSubmitting = false;
    submitButton.disabled = false;
    return;
  }

  localStorage.setItem("a1KitchenCurrentOrder", JSON.stringify(data));
  localStorage.setItem("a1KitchenOrderNumber", data.order_number);
  localStorage.setItem("a1KitchenCustomerToken", data.customer_token);
  localStorage.setItem(
    "a1KitchenOrderSummary",
    JSON.stringify({
      items: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: toPrice(item.price),
      })),
      method: method,
      location: location,
    }),
  );
  localStorage.removeItem("a1KitchenCart");

  window.location.href = "payment.html";
});

cart = loadCart();
updateDeliveryFields();
displayOrder();
refreshPrices();
