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

const MAX_PER_ITEM = 20;

let cart = [];
let isSubmitting = false;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];

    return saved.filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        Number.isFinite(Number(item.price)) &&
        Number.isInteger(Number(item.quantity)) &&
        Number(item.quantity) >= 1 &&
        Number(item.quantity) <= MAX_PER_ITEM,
    );
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

function displayOrder() {
  orderSummary.textContent = "";

  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.textContent =
      "Your order is empty. Please return to the menu and add food first.";
    orderSummary.appendChild(empty);
    orderTotal.textContent = "0";
    return;
  }

  let total = 0;

  cart.forEach((item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    total += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const line = document.createElement("p");
    line.textContent =
      item.quantity + " × NLe " + item.price + " = NLe " + itemTotal;

    info.append(name, line);
    row.appendChild(info);
    orderSummary.appendChild(row);
  });

  orderTotal.textContent = total;
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
    // The server always calculates the final total, so we can carry on
  }
}

function updateDeliveryFields() {
  const isDelivery = deliveryMethod.value === "delivery";

  deliveryLocationContainer.hidden = !isDelivery;
  deliveryLocation.required = isDelivery;

  if (!isDelivery) {
    deliveryLocation.value = "";
  }
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
  localStorage.removeItem("a1KitchenCart");

  window.location.href = "payment.html";
});

cart = loadCart();
updateDeliveryFields();
displayOrder();
refreshPrices();
