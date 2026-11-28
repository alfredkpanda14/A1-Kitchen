/* A1 Kitchen: Delivery areas and fees (Developer, Head Chef, Manager) */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const areaForm = document.getElementById("area-form");
const newName = document.getElementById("new-name");
const newFee = document.getElementById("new-fee");
const newSort = document.getElementById("new-sort");
const addButton = document.getElementById("add-button");
const areaList = document.getElementById("area-list");
const signOutButton = document.getElementById("signout-button");

let staff = null;

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

function say(text) {
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
  if (text.length > 0 && text.length < 200) {
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

function input(type, id, value) {
  const node = el("input");
  node.type = type;
  node.id = id;
  node.value = value === null || value === undefined ? "" : String(value);
  node.autocomplete = "off";
  return node;
}

function field(labelText, control) {
  const wrapper = el("div", "menu-field");
  const label = el("label", null, labelText);
  label.htmlFor = control.id;
  wrapper.append(label, control);
  return wrapper;
}

function readFee(value) {
  if (String(value).trim() === "") {
    return NaN;
  }
  return Number(value);
}

function areaRow(area) {
  const row = el("article", "area-row");
  if (!area.active) {
    row.classList.add("is-off");
  }

  const name = input("text", "name-" + area.id, area.name);
  name.maxLength = 60;
  const fee = input("number", "fee-" + area.id, area.fee);
  fee.min = "0";
  fee.step = "0.01";
  fee.inputMode = "decimal";
  const sort = input("number", "sort-" + area.id, area.sort_order);
  sort.min = "0";
  sort.max = "9999";

  const activeLabel = el("label", "checkbox-label");
  const active = el("input");
  active.type = "checkbox";
  active.checked = Boolean(area.active);
  activeLabel.append(active, document.createTextNode(" Shown to customers"));

  const save = el("button", "button", "Save");
  save.type = "button";
  const remove = el("button", "button button-secondary", "Delete");
  remove.type = "button";
  const buttons = el("div", "area-buttons");
  buttons.append(save, remove);

  save.addEventListener("click", async () => {
    const feeValue = readFee(fee.value);
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      say("Please enter a delivery fee of 0 or more.");
      fee.focus();
      return;
    }
    save.disabled = true;
    try {
      await rpc("staff_save_delivery_area", {
        p_id: area.id,
        p_name: name.value,
        p_fee: feeValue,
        p_active: active.checked,
        p_sort_order: Number(sort.value) || 0,
      });
      say(name.value.trim() + " saved.");
      await load();
    } catch (error) {
      save.disabled = false;
      say(friendlyError(error));
    }
  });

  remove.addEventListener("click", () => {
    if (row.querySelector(".help-confirm")) {
      return;
    }
    const box = el("div", "help-confirm");
    box.appendChild(
      el(
        "p",
        null,
        "Delete " +
          area.name +
          '? Old orders keep their area name. To hide it for a while, untick "Shown to customers" instead.',
      ),
    );
    const yes = el("button", "button button-danger", "Yes, delete");
    yes.type = "button";
    const no = el("button", "button button-secondary", "Cancel");
    no.type = "button";
    no.addEventListener("click", () => box.remove());
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      try {
        await rpc("staff_delete_delivery_area", { p_id: area.id });
        say(area.name + " deleted.");
        await load();
      } catch (error) {
        yes.disabled = false;
        say(friendlyError(error));
      }
    });
    const confirmRow = el("div", "help-buttons");
    confirmRow.append(yes, no);
    box.appendChild(confirmRow);
    row.appendChild(box);
  });

  row.append(
    field("Area name", name),
    field("Fee (NLe)", fee),
    field("List order", sort),
    activeLabel,
    buttons,
  );
  return row;
}

async function load() {
  const areas = (await rpc("staff_list_delivery_areas")) || [];
  areaList.textContent = "";
  if (areas.length === 0) {
    areaList.appendChild(
      el(
        "p",
        "guide-empty",
        "No areas yet. Add your first delivery area above. Until you do, the order page works as before.",
      ),
    );
    return;
  }
  const shown = areas.filter((area) => area.active).length;
  areaList.appendChild(
    el(
      "p",
      "special-summary",
      areas.length +
        (areas.length === 1 ? " area, " : " areas, ") +
        shown +
        " shown to customers.",
    ),
  );
  areas.forEach((area) => areaList.appendChild(areaRow(area)));
}

areaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feeValue = readFee(newFee.value);
  if (newName.value.trim().length < 2) {
    say("Please type the area name.");
    newName.focus();
    return;
  }
  if (!Number.isFinite(feeValue) || feeValue < 0) {
    say("Please enter a delivery fee of 0 or more.");
    newFee.focus();
    return;
  }
  addButton.disabled = true;
  try {
    await rpc("staff_save_delivery_area", {
      p_id: null,
      p_name: newName.value,
      p_fee: feeValue,
      p_active: true,
      p_sort_order: Number(newSort.value) || 100,
    });
    say(newName.value.trim() + " added.");
    areaForm.reset();
    newSort.value = "100";
    await load();
    newName.focus();
  } catch (error) {
    say(friendlyError(error));
  }
  addButton.disabled = false;
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

async function start() {
  const { data: session } = await supabaseClient.auth.getSession();
  if (!session || !session.session) {
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
  if (!can("delivery.manage")) {
    goTo("chef-dashboard.html");
    return;
  }
  document.getElementById("nav-developer").hidden = !can("staff.manage");
  welcome.textContent =
    "Signed in as " +
    staff.full_name +
    " (" +
    String(staff.role || "").replace(/_/g, " ") +
    ")";
  try {
    await load();
  } catch (loadError) {
    say(friendlyError(loadError));
  }
}

start();
