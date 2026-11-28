/* A1 Kitchen: My Orders (the orders made on this phone) */
const MY_ORDERS_KEY = "a1KitchenMyOrders";
const ORDER_PATTERN = /^A1-\d{8}-[A-Z0-9]{6}$/;
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_ITEM = 20;

const ordersList = document.getElementById("orders-list");
const ordersEmpty = document.getElementById("orders-empty");
const ordersMessage = document.getElementById("orders-message");

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

function setMessage(text) {
  ordersMessage.textContent = text;
}

function readList() {
  try {
    const list = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function saveList(list) {
  try {
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, 40)));
  } catch (error) {
    /* storage is full or switched off */
  }
}

/* Make sure the latest order on this phone is in the list */
function addCurrentOrder() {
  const number = (localStorage.getItem("a1KitchenOrderNumber") || "").trim();
  const token = (localStorage.getItem("a1KitchenCustomerToken") || "").trim();
  if (!ORDER_PATTERN.test(number) || !TOKEN_PATTERN.test(token)) {
    return;
  }
  const list = readList();
  if (!list.some((item) => item && item.o === number)) {
    list.unshift({ o: number, t: token, at: Date.now() });
    saveList(list);
  }
}

function savedOrders() {
  return readList().filter(
    (item) =>
      item &&
      !item.removed &&
      ORDER_PATTERN.test(item.o || "") &&
      TOKEN_PATTERN.test(item.t || ""),
  );
}

function removeOrder(number) {
  const list = readList();
  list.forEach((item) => {
    if (item && item.o === number) {
      item.removed = true;
    }
  });
  saveList(list);
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
    throw new Error((body && body.message) || "Request failed");
  }
  return body;
}

function money(value) {
  return "NLe " + Number(value || 0).toLocaleString("en-GB");
}

function orderDate(value) {
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

/* A short, friendly status and a colour for it */
function statusLook(order) {
  const status = order.order_status || "";
  const payment = order.payment_status || "";

  if (status === "Cancelled") {
    return { text: "Cancelled", kind: "off" };
  }
  if (status.indexOf("Delivered") === 0) {
    return { text: "Delivered", kind: "done" };
  }
  if (status === "Out for Delivery") {
    return { text: "On the way", kind: "busy" };
  }
  if (status === "Ready for Pickup") {
    return { text: "Ready for pickup", kind: "busy" };
  }
  if (status === "Preparing") {
    return { text: "Being prepared", kind: "busy" };
  }
  if (payment === "Payment Verified") {
    return { text: "Paid", kind: "busy" };
  }
  if (
    /awaiting quote/i.test(payment) ||
    (order.quote_required && !Number(order.total))
  ) {
    return { text: "Waiting for price", kind: "wait" };
  }
  if (/rejected/i.test(payment)) {
    return { text: "Screenshot not accepted", kind: "alert" };
  }
  if (/proof submitted|needs review/i.test(payment)) {
    return { text: "Checking payment", kind: "wait" };
  }
  return { text: "Payment needed", kind: "wait" };
}

function trackingLink(saved) {
  return (
    "track-order.html#o=" +
    encodeURIComponent(saved.o) +
    "&t=" +
    encodeURIComponent(saved.t)
  );
}

/* Put the same food in the basket and open the order page */
function orderAgain(order) {
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("a1KitchenCart")) || [];
    if (!Array.isArray(cart)) {
      cart = [];
    }
  } catch (error) {
    cart = [];
  }

  (order.items || []).forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    if (!item.name || quantity < 1) {
      return;
    }
    const existing = cart.find((line) => line && line.name === item.name);
    if (existing) {
      existing.quantity = Math.min(
        MAX_PER_ITEM,
        Number(existing.quantity || 0) + quantity,
      );
    } else {
      cart.push({
        name: item.name,
        price:
          item.unit_price === null || item.unit_price === undefined
            ? null
            : Number(item.unit_price),
        quantity: Math.min(MAX_PER_ITEM, quantity),
      });
    }
  });

  localStorage.setItem("a1KitchenCart", JSON.stringify(cart));
  /* The order page checks today's prices and removes any dish that is not available */
  window.location.href = "order.html";
}

function renderCard(saved, order, failed) {
  const card = make("article", "my-order");

  const top = make("div", "my-order-top");
  top.appendChild(make("p", "my-order-number", saved.o));
  if (order) {
    const look = statusLook(order);
    top.appendChild(make("span", "my-order-status is-" + look.kind, look.text));
  }
  card.appendChild(top);

  if (failed === "missing") {
    card.appendChild(
      make(
        "p",
        "my-order-note",
        "We could not find this order. It may have been removed by A1 Kitchen.",
      ),
    );
  } else if (failed) {
    card.appendChild(
      make(
        "p",
        "my-order-note",
        "We could not check this order right now. Please check your internet connection.",
      ),
    );
  }

  if (order) {
    const facts = make("p", "my-order-facts");
    const parts = [orderDate(order.created_at)];
    parts.push(order.delivery_method === "delivery" ? "Delivery" : "Pickup");
    if (order.quote_required && !Number(order.total)) {
      parts.push("Price to be confirmed");
    } else {
      parts.push(money(order.total));
    }
    facts.textContent = parts.filter(Boolean).join(" · ");
    card.appendChild(facts);

    const items = order.items || [];
    if (items.length) {
      const list = make("ul", "my-order-items");
      items.forEach((item) => {
        list.appendChild(make("li", null, item.quantity + " × " + item.name));
      });
      card.appendChild(list);
    }
  }

  const buttons = make("div", "my-order-buttons");
  if (!failed || failed === "offline") {
    const track = make("a", "button", "Track order");
    track.href = trackingLink(saved);
    buttons.appendChild(track);
  }
  if (order && (order.items || []).length) {
    const again = make("button", "button button-secondary", "Order again");
    again.type = "button";
    again.addEventListener("click", () => orderAgain(order));
    buttons.appendChild(again);
  }
  const remove = make("button", "my-order-remove", "Remove from this phone");
  remove.type = "button";
  remove.addEventListener("click", () => {
    removeOrder(saved.o);
    card.remove();
    setMessage("Order " + saved.o + " was removed from this phone.");
    if (!ordersList.querySelector(".my-order")) {
      ordersEmpty.hidden = false;
    }
  });
  buttons.appendChild(remove);
  card.appendChild(buttons);

  return card;
}

async function loadOne(saved) {
  try {
    const order = await callRpc("get_order_status", {
      p_order_number: saved.o,
      p_customer_token: saved.t,
    });
    return { saved, order, failed: null };
  } catch (error) {
    const missing = (error.message || "").includes("Order not found");
    return { saved, order: null, failed: missing ? "missing" : "offline" };
  }
}

async function start() {
  addCurrentOrder();
  const orders = savedOrders();

  if (orders.length === 0) {
    ordersEmpty.hidden = false;
    return;
  }

  setMessage("Loading your orders...");

  /* Five at a time, so slow connections are not overloaded */
  const results = [];
  for (let i = 0; i < orders.length; i += 5) {
    const batch = await Promise.all(orders.slice(i, i + 5).map(loadOne));
    results.push(...batch);
  }

  /* Newest first */
  results.sort((a, b) => {
    const timeA = a.order
      ? new Date(a.order.created_at).getTime()
      : a.saved.at || 0;
    const timeB = b.order
      ? new Date(b.order.created_at).getTime()
      : b.saved.at || 0;
    return timeB - timeA;
  });

  ordersList.textContent = "";
  results.forEach((result) => {
    ordersList.appendChild(
      renderCard(result.saved, result.order, result.failed),
    );
  });

  const offline = results.filter(
    (result) => result.failed === "offline",
  ).length;
  setMessage(
    offline
      ? "Some orders could not be checked. Please try again when you have internet."
      : "",
  );
}

start();
