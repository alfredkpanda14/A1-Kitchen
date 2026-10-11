/* ---------- Page elements ---------- */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const priceTools = document.getElementById("price-tools");
const showPricesButton = document.getElementById("show-prices");
const hidePricesButton = document.getElementById("hide-prices");
const newFoodBox = document.getElementById("new-food-box");
const foodList = document.getElementById("food-list");
const categoryList = document.getElementById("category-list");

const PHOTO_BUCKET = "menu-images";
const MAX_PHOTO_WIDTH = 900;

let staff = null;
let foods = [];

/* ---------- Small helpers ---------- */
function el(tag, className, text) {
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
  dashMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function goTo(page) {
  window.location.href = page;
}

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "No connection. Please check your internet and try again.";
  }

  if (text.length > 0 && text.length < 160) {
    return text;
  }

  return "Something went wrong. Please try again.";
}

async function rpc(name, params) {
  const { data, error } = await supabaseClient.rpc(name, params || {});

  if (error) {
    if (error.code === "PGRST301" || /jwt/i.test(error.message || "")) {
      goTo("staff-login.html");
    }

    throw new Error(error.message || "Request failed");
  }

  return data;
}

async function runAction(button, work, doneMessage) {
  button.disabled = true;
  setMessage("Working...");

  try {
    await work();
    await loadFoods();
    setMessage(doneMessage);
  } catch (error) {
    console.error("Action failed:", error);
    setMessage(friendlyError(error));
    button.disabled = false;
  }
}

/* ---------- Form fields ---------- */
function field(labelText, input, helpText) {
  const wrapper = el("div", "menu-field");
  const label = el("label", null, labelText);
  label.htmlFor = input.id;
  wrapper.append(label, input);

  if (helpText) {
    wrapper.appendChild(el("p", "field-help", helpText));
  }

  return wrapper;
}

function buildFields(idPrefix, food) {
  const nameInput = el("input");
  nameInput.id = idPrefix + "-name";
  nameInput.type = "text";
  nameInput.maxLength = 100;
  nameInput.autocomplete = "off";
  nameInput.value = food.name || "";

  const descInput = el("textarea");
  descInput.id = idPrefix + "-description";
  descInput.rows = 3;
  descInput.maxLength = 500;
  descInput.value = food.description || "";

  const categoryInput = el("input");
  categoryInput.id = idPrefix + "-category";
  categoryInput.type = "text";
  categoryInput.maxLength = 50;
  categoryInput.autocomplete = "off";
  categoryInput.setAttribute("list", "category-list");
  categoryInput.value = food.category || "";

  const priceInput = el("input");
  priceInput.id = idPrefix + "-price";
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "0.01";
  priceInput.inputMode = "decimal";
  priceInput.value =
    food.price === null || food.price === undefined ? "" : food.price;

  const sortInput = el("input");
  sortInput.id = idPrefix + "-sort";
  sortInput.type = "number";
  sortInput.min = "0";
  sortInput.max = "9999";
  sortInput.step = "1";
  sortInput.value = food.sort_order === undefined ? 100 : food.sort_order;

  const availableInput = el("input");
  availableInput.id = idPrefix + "-available";
  availableInput.type = "checkbox";
  availableInput.checked = food.available !== false;

  const availableWrapper = el("div", "menu-field");
  const availableLabel = el("label", "checkbox-label");
  availableLabel.htmlFor = availableInput.id;
  availableLabel.append(
    availableInput,
    document.createTextNode(" Show this food on the menu"),
  );
  availableWrapper.appendChild(availableLabel);

  const wrapper = el("div");
  wrapper.append(
    field("Name", nameInput),
    field("Description", descInput),
    field(
      "Category",
      categoryInput,
      "Foods with the same category get a filter button on the menu.",
    ),
    field("Price (NLe)", priceInput, "Leave empty to show 'Price on request'."),
    field(
      "Order on the menu",
      sortInput,
      "Smaller numbers come first. Foods with the same number are sorted by name.",
    ),
    availableWrapper,
  );

  return {
    wrapper: wrapper,
    read: () => ({
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      category: categoryInput.value.trim(),
      price: priceInput.value === "" ? null : Number(priceInput.value),
      sort: sortInput.value === "" ? 100 : Number(sortInput.value),
      available: availableInput.checked,
    }),
    focusName: () => nameInput.focus(),
    reset: () => {
      nameInput.value = "";
      descInput.value = "";
      categoryInput.value = "";
      priceInput.value = "";
      sortInput.value = 100;
      availableInput.checked = true;
    },
  };
}

function validate(values) {
  if (values.name.length < 2) {
    return "Please enter the food's name.";
  }

  if (
    values.price !== null &&
    (!Number.isFinite(values.price) || values.price < 0)
  ) {
    return "Please enter a valid price, or leave it empty.";
  }

  if (!Number.isFinite(values.sort) || values.sort < 0 || values.sort > 9999) {
    return "The order number must be between 0 and 9999.";
  }

  return "";
}

function saveParams(id, values) {
  return {
    p_id: id,
    p_name: values.name,
    p_description: values.description,
    p_price: values.price,
    p_available: values.available,
    p_category: values.category,
    p_sort_order: values.sort,
  };
}

/* ---------- Photos ---------- */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as a picture."));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/* Shrinks a phone photo so it loads fast for customers */
async function preparePhoto(file) {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_PHOTO_WIDTH / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToBlob(canvas, "image/webp", 0.8);

  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
  }

  if (!blob) {
    throw new Error("The picture could not be prepared.");
  }

  return blob;
}

function storagePathFromUrl(url) {
  const marker = "/object/public/" + PHOTO_BUCKET + "/";
  const index = url ? url.indexOf(marker) : -1;
  return index === -1 ? "" : url.slice(index + marker.length);
}

async function uploadPhoto(food, file) {
  const blob = await preparePhoto(file);
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const path = food.id + "-" + Date.now() + "." + extension;

  const { error: uploadError } = await supabaseClient.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error("The photo could not be uploaded.");
  }

  const { data } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(path);

  await rpc("staff_set_menu_photo", {
    p_id: food.id,
    p_image_url: data.publicUrl,
  });

  // Tidy up the old photo if it was stored here (best effort)
  const oldPath = storagePathFromUrl(food.image_path);

  if (oldPath) {
    await supabaseClient.storage.from(PHOTO_BUCKET).remove([oldPath]);
  }
}

function photoBox(food) {
  const box = el("div", "photo-box");
  box.appendChild(el("h4", null, "Photo"));

  if (food.image_path) {
    const image = el("img", "menu-thumb");
    image.src = food.image_path;
    image.alt = "Photo of " + food.name;
    image.width = 400;
    image.height = 300;
    image.loading = "lazy";
    box.appendChild(image);
  } else {
    box.appendChild(el("p", null, "No photo yet."));
  }

  if (!can("menu.photos")) {
    box.appendChild(
      el("p", "field-help", "Food photos are added by the designer."),
    );
    return box;
  }

  const fileInput = el("input");
  fileInput.type = "file";
  fileInput.id = "photo-" + food.id;
  fileInput.accept = "image/jpeg,image/png,image/webp";

  const fileLabel = el("label", null, "Choose a photo (landscape works best)");
  fileLabel.htmlFor = fileInput.id;

  const uploadButton = el("button", "button", "Upload photo");
  uploadButton.type = "button";
  uploadButton.addEventListener("click", () => {
    const file = fileInput.files[0];

    if (!file) {
      setMessage("Please choose a photo first.");
      return;
    }

    runAction(
      uploadButton,
      () => uploadPhoto(food, file),
      "Photo uploaded for " + food.name + ".",
    );
  });

  box.append(fileLabel, fileInput, el("br"), uploadButton);

  if (food.image_path) {
    const removeButton = el(
      "button",
      "button button-secondary",
      "Remove photo",
    );
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      if (!window.confirm("Remove the photo of " + food.name + "?")) {
        return;
      }

      runAction(
        removeButton,
        async () => {
          await rpc("staff_set_menu_photo", {
            p_id: food.id,
            p_image_url: null,
          });

          const oldPath = storagePathFromUrl(food.image_path);

          if (oldPath) {
            await supabaseClient.storage.from(PHOTO_BUCKET).remove([oldPath]);
          }
        },
        "Photo removed.",
      );
    });
    box.appendChild(removeButton);
  }

  return box;
}

/* ---------- Food cards ---------- */
function foodCard(food) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, food.name));

  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " + (food.available ? "badge-good" : "badge-bad"),
      food.available ? "On the menu" : "Hidden",
    ),
  );
  badges.appendChild(
    el(
      "span",
      "badge",
      food.price === null ? "Price on request" : "NLe " + Number(food.price),
    ),
  );
  card.appendChild(badges);

  const fields = buildFields("food-" + food.id, food);
  card.appendChild(fields.wrapper);

  const saveButton = el("button", "button", "Save changes");
  saveButton.type = "button";
  saveButton.addEventListener("click", () => {
    const values = fields.read();
    const problem = validate(values);

    if (problem) {
      setMessage(problem);
      return;
    }

    runAction(
      saveButton,
      () => rpc("staff_save_menu_item", saveParams(food.id, values)),
      food.name + " saved.",
    );
  });

  card.append(saveButton, photoBox(food));
  return card;
}

function newFoodCard() {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Add a new food"));

  const fields = buildFields("new-food", {});
  card.appendChild(fields.wrapper);

  const addButton = el("button", "button", "Add this food");
  addButton.type = "button";
  addButton.addEventListener("click", async () => {
    const values = fields.read();
    const problem = validate(values);

    if (problem) {
      setMessage(problem);
      return;
    }

    addButton.disabled = true;
    setMessage("Adding...");

    try {
      await rpc("staff_save_menu_item", saveParams(null, values));
      fields.reset();
      await loadFoods();
      setMessage(
        values.name +
          " added. " +
          (can("menu.photos")
            ? "You can now add its photo below."
            : "The designer will add its photo."),
      );
    } catch (error) {
      console.error("Add failed:", error);
      setMessage(friendlyError(error));
    }

    addButton.disabled = false;
  });

  card.appendChild(addButton);
  return card;
}

function renderFoods() {
  newFoodBox.textContent = "";
  newFoodBox.appendChild(newFoodCard());

  foodList.textContent = "";

  if (foods.length === 0) {
    foodList.appendChild(el("p", null, "There are no foods yet."));
    return;
  }

  foods.forEach((food) => foodList.appendChild(foodCard(food)));

  categoryList.textContent = "";
  const seen = [];

  foods.forEach((food) => {
    if (food.category && !seen.includes(food.category)) {
      seen.push(food.category);
      const option = el("option");
      option.value = food.category;
      categoryList.appendChild(option);
    }
  });
}

async function loadFoods() {
  foods = (await rpc("staff_get_menu")) || [];
  renderFoods();
}

/* ---------- Price switch ---------- */
showPricesButton.addEventListener("click", () => {
  const question =
    "Show prices on the menu? Every food that has a saved price will show it, and customers who collect their order will go straight to payment.";

  if (!window.confirm(question)) {
    return;
  }

  runAction(
    showPricesButton,
    () => rpc("staff_prices_show_all"),
    "Saved prices are now showing.",
  );
});

hidePricesButton.addEventListener("click", () => {
  const question =
    "Hide all prices? Every food will show 'Price on request'. Your prices are kept safely so you can show them again.";

  if (!window.confirm(question)) {
    return;
  }

  runAction(
    hidePricesButton,
    () => rpc("staff_prices_hide_all"),
    "All prices are hidden. Prices are saved for later.",
  );
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

refreshButton.addEventListener("click", async () => {
  setMessage("Loading...");

  try {
    await loadFoods();
    setMessage("");
  } catch (error) {
    setMessage(friendlyError(error));
  }
});

/* ---------- Start ---------- */
async function start() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data || !data.session) {
    goTo("staff-login.html");
    return;
  }

  const { data: info, error } = await supabaseClient.rpc("my_staff_info");

  if (error || !info) {
    await supabaseClient.auth.signOut();
    goTo("staff-login.html");
    return;
  }

  staff = info;

  if (!can("menu.manage")) {
    goTo("chef-dashboard.html");
    return;
  }

  document.getElementById("nav-developer").hidden = !can("staff.manage");

  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    staff.role.replace("_", " ") +
    ")";

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      goTo("staff-login.html");
    }
  });

  priceTools.hidden = false;
  setMessage("Loading...");

  try {
    await loadFoods();
    setMessage("");
  } catch (loadError) {
    console.error("Load error:", loadError);
    setMessage(friendlyError(loadError));
  }
}

start();
