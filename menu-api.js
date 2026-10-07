/* Shared menu helpers (used by the menu page and the order page) */

const MENU_URL =
  SUPABASE_URL +
  "/rest/v1/menu_items?select=id,name,description,price,image_path,category,sort_order" +
  "&available=eq.true&order=sort_order.asc,name.asc";

const MENU_CACHE_KEY = "a1KitchenMenuCache";

async function fetchAvailableMenu() {
  const response = await fetch(MENU_URL, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Menu request failed with status " + response.status);
  }

  const data = await response.json();

  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    // Saving a copy is optional, so ignore storage problems
  }

  return data;
}

function loadSavedMenu() {
  try {
    return JSON.parse(localStorage.getItem(MENU_CACHE_KEY));
  } catch (error) {
    return null;
  }
}

/*
  Updates cart prices from the live menu and removes foods that are no
  longer available. Returns the new cart and a list of messages.
*/
function syncCartWithMenu(cartItems, menuItems) {
  const liveByName = new Map(menuItems.map((item) => [item.name, item]));
  const messages = [];
  const updated = [];

  cartItems.forEach((item) => {
    const live = liveByName.get(item.name);

    if (!live) {
      messages.push(
        item.name + " is no longer available and was removed from your order.",
      );
      return;
    }

    const livePrice = Number(live.price);

    if (livePrice !== Number(item.price)) {
      messages.push(
        "The price of " + item.name + " is now NLe " + livePrice + ".",
      );
    }

    updated.push({
      name: item.name,
      price: livePrice,
      quantity: item.quantity,
    });
  });

  return { cart: updated, messages: messages };
}
