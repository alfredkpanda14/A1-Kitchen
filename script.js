const cartItemsContainer = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const emptyCart = document.getElementById("empty-cart");
const cartNotice = document.getElementById("cart-notice");

const MAX_PER_ITEM = 20;

let cart = [];

try {
  cart = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];
} catch (error) {
  cart = [];
}

function saveCart() {
  localStorage.setItem("a1KitchenCart", JSON.stringify(cart));
}

function renderCart() {
  cartItemsContainer.textContent = "";

  let total = 0;

  emptyCart.style.display = cart.length === 0 ? "block" : "none";

  cart.forEach((item, index) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    total += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const line = document.createElement("p");
    line.textContent =
      "NLe " + item.price + " × " + item.quantity + " = NLe " + itemTotal;
    info.appendChild(name);
    info.appendChild(line);

    const controls = document.createElement("div");
    controls.className = "cart-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease quantity of " + item.name);
    minus.dataset.action = "decrease";
    minus.dataset.index = index;

    const quantity = document.createElement("span");
    quantity.textContent = item.quantity;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase quantity of " + item.name);
    plus.dataset.action = "increase";
    plus.dataset.index = index;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.dataset.action = "remove";
    remove.dataset.index = index;

    controls.append(minus, quantity, plus, remove);
    row.append(info, controls);
    cartItemsContainer.appendChild(row);
  });

  cartTotal.textContent = total;
  saveCart();
}

function addToCart(name, price) {
  const existingItem = cart.find((item) => item.name === name);

  if (existingItem) {
    if (existingItem.quantity >= MAX_PER_ITEM) {
      cartNotice.textContent =
        "Maximum " +
        MAX_PER_ITEM +
        " of one item. For large orders, see Catering.";
      return;
    }
    existingItem.quantity += 1;
  } else {
    cart.push({ name: name, price: Number(price), quantity: 1 });
  }

  cartNotice.textContent = name + " has been added to your order.";
  renderCart();
}

/* Called by menu.js after the live menu loads */
function applyMenuToCart(menuItems) {
  const result = syncCartWithMenu(cart, menuItems);
  cart = result.cart;
  renderCart();

  if (result.messages.length > 0) {
    cartNotice.textContent = result.messages.join(" ");
  }
}

document.addEventListener("click", (event) => {
  const orderButton = event.target.closest(".order-button");

  if (orderButton) {
    addToCart(orderButton.dataset.name, orderButton.dataset.price);
  }
});

cartItemsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "increase" && cart[index].quantity < MAX_PER_ITEM) {
    cart[index].quantity += 1;
  } else if (action === "decrease") {
    cart[index].quantity -= 1;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
  } else if (action === "remove") {
    cart.splice(index, 1);
  }

  renderCart();
});

renderCart();
