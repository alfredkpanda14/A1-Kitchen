const orderButtons = document.querySelectorAll(".order-button");
const cartItemsContainer = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const emptyCart = document.getElementById("empty-cart");

let cart = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];

function saveCart() {
  localStorage.setItem("a1KitchenCart", JSON.stringify(cart));
}

function renderCart() {
  cartItemsContainer.innerHTML = "";

  let total = 0;

  if (cart.length === 0) {
    emptyCart.style.display = "block";
  } else {
    emptyCart.style.display = "none";
  }

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;

    total += itemTotal;

    const row = document.createElement("div");

    row.className = "cart-item";

    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p>
          NLe ${item.price} × ${item.quantity}
          = NLe ${itemTotal}
        </p>
      </div>

      <div class="cart-controls">
        <button onclick="changeQuantity(${index}, -1)">−</button>

        <span>${item.quantity}</span>

        <button onclick="changeQuantity(${index}, 1)">+</button>

        <button onclick="removeItem(${index})">
          Remove
        </button>
      </div>
    `;

    cartItemsContainer.appendChild(row);
  });

  cartTotal.textContent = total;

  saveCart();
}

function addToCart(name, price) {
  const existingItem = cart.find((item) => item.name === name);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      name: name,
      price: Number(price),
      quantity: 1,
    });
  }

  renderCart();

  alert(name + " has been added to your order.");
}

function changeQuantity(index, amount) {
  cart[index].quantity += amount;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);

  renderCart();
}

orderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    addToCart(button.dataset.name, button.dataset.price);
  });
});

renderCart();
