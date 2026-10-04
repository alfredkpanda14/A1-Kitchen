const orderForm = document.getElementById("order-form");

const orderSummary = document.getElementById("order-summary");

const orderTotal = document.getElementById("order-total");

const orderMessage = document.getElementById("order-message");

const deliveryMethod = document.getElementById("delivery-method");

const deliveryLocation = document.getElementById("delivery-location");

const cart = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];

function displayOrder() {
  orderSummary.innerHTML = "";

  if (cart.length === 0) {
    orderSummary.innerHTML = `
      <p>
        Your order is empty.
        Please return to the menu and add food first.
      </p>
    `;

    orderTotal.textContent = "0";

    return;
  }

  let total = 0;

  cart.forEach((item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);

    total += itemTotal;

    const row = document.createElement("div");

    row.className = "cart-item";

    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>

        <p>
          ${item.quantity}
          × NLe ${item.price}
          = NLe ${itemTotal}
        </p>
      </div>
    `;

    orderSummary.appendChild(row);
  });

  orderTotal.textContent = total;
}

deliveryMethod.addEventListener("change", () => {
  if (deliveryMethod.value === "delivery") {
    deliveryLocation.required = true;
  } else {
    deliveryLocation.required = false;
  }
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (cart.length === 0) {
    orderMessage.textContent =
      "Your order is empty. Please return to the menu.";

    return;
  }

  const customerName = document.getElementById("customer-name").value.trim();

  const phone = document.getElementById("phone").value.trim();

  const whatsapp = document.getElementById("whatsapp").value.trim();

  const method = deliveryMethod.value;

  const location = deliveryLocation.value.trim();

  const deliveryNotes = document.getElementById("delivery-notes").value.trim();

  const orderNotes = document.getElementById("order-notes").value.trim();

  if (method === "delivery" && !location) {
    orderMessage.textContent = "Please enter your delivery location.";

    return;
  }

  orderMessage.textContent = "Submitting your order...";

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

    orderMessage.textContent =
      "ORDER ERROR\n\n" +
      "Message: " +
      (error.message || "No message") +
      "\n\n" +
      "Code: " +
      (error.code || "No code") +
      "\n\n" +
      "Details: " +
      (error.details || "No details") +
      "\n\n" +
      "Hint: " +
      (error.hint || "No hint");

    return;
  }

  localStorage.setItem("a1KitchenCurrentOrder", JSON.stringify(data));

  localStorage.setItem("a1KitchenOrderNumber", data.order_number);

  localStorage.setItem("a1KitchenCustomerToken", data.customer_token);

  localStorage.removeItem("a1KitchenCart");

  window.location.href = "payment.html";
});

displayOrder();
