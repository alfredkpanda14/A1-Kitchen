/* ---------- Page elements ---------- */
const welcome = document.getElementById("welcome");
const dashMessage = document.getElementById("dash-message");
const refreshButton = document.getElementById("refresh-button");
const signOutButton = document.getElementById("signout-button");
const newEventBox = document.getElementById("new-event-box");
const eventList = document.getElementById("event-list");

const EVENT_STATUSES = [
  ["draft", "Draft (not shown to the public)"],
  ["published", "Published (shown to the public)"],
  ["closed", "Closed (finished)"],
];

let staff = null;
let events = [];

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

function money(value) {
  return "NLe " + Number(value || 0);
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function longDate(dateText) {
  const date = new Date(dateText + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return dateText || "";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addYear(dateText) {
  const date = new Date(dateText + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  date.setFullYear(date.getFullYear() + 1);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
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
    await loadEvents();
    setMessage(doneMessage);
  } catch (error) {
    console.error("Action failed:", error);
    setMessage(friendlyError(error));
    button.disabled = false;
  }
}

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

function addDetail(parent, label, value) {
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

/* ---------- WhatsApp thank-you ---------- */
function whatsappDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.startsWith("232")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return "232" + digits.slice(1);
  }

  if (digits.length === 8) {
    return "232" + digits;
  }

  return digits;
}

/* Removes a year from an event name, so "Outing 2026" reads well next year */
function plainTitle(title) {
  return String(title || "")
    .replace(/\s*\b20\d{2}\b/g, "")
    .trim();
}

function thankYouText(registration, event, nextEvent) {
  let nextText = "our next event";

  if (nextEvent) {
    nextText =
      plainTitle(nextEvent.title) + " on " + longDate(nextEvent.event_date);
  } else if (event.repeats_yearly) {
    nextText =
      plainTitle(event.title) + " on " + longDate(addYear(event.event_date));
  }

  return (
    "Dear " +
    registration.full_name +
    ",\n\nThank you for taking part in " +
    plainTitle(event.title) +
    " on " +
    longDate(event.event_date) +
    ". Your registration for " +
    longDate(event.event_date) +
    " has now ended.\n\nWe would love to see you again. Please register or sign in for " +
    nextText +
    " at https://a1-kitchen.netlify.app/events.html\n\nWith thanks,\nA1 Kitchen"
  );
}

function whatsappLink(registration, event, nextEvent) {
  return (
    "https://wa.me/" +
    whatsappDigits(registration.phone) +
    "?text=" +
    encodeURIComponent(thankYouText(registration, event, nextEvent))
  );
}

/* ---------- Event details form ---------- */
function eventFields(prefix, event) {
  const titleInput = el("input");
  titleInput.id = prefix + "-title";
  titleInput.type = "text";
  titleInput.maxLength = 120;
  titleInput.autocomplete = "off";
  titleInput.value = event.title || "";

  const descInput = el("textarea");
  descInput.id = prefix + "-description";
  descInput.rows = 3;
  descInput.maxLength = 1500;
  descInput.value = event.description || "";

  const dateInput = el("input");
  dateInput.id = prefix + "-date";
  dateInput.type = "date";
  dateInput.value = event.event_date || "";

  const timeInput = el("input");
  timeInput.id = prefix + "-time";
  timeInput.type = "text";
  timeInput.maxLength = 60;
  timeInput.autocomplete = "off";
  timeInput.value = event.start_time || "";

  const locationInput = el("input");
  locationInput.id = prefix + "-location";
  locationInput.type = "text";
  locationInput.maxLength = 300;
  locationInput.autocomplete = "off";
  locationInput.value = event.location || "";

  const statusSelect = el("select");
  statusSelect.id = prefix + "-status";
  EVENT_STATUSES.forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    option.selected = value === (event.status || "draft");
    statusSelect.appendChild(option);
  });

  const openInput = el("input");
  openInput.id = prefix + "-open";
  openInput.type = "checkbox";
  openInput.checked = event.registration_open !== false;
  const openLabel = el("label", "checkbox-label");
  openLabel.htmlFor = openInput.id;
  openLabel.append(openInput, document.createTextNode(" Registration is open"));

  const repeatsInput = el("input");
  repeatsInput.id = prefix + "-repeats";
  repeatsInput.type = "checkbox";
  repeatsInput.checked = Boolean(event.repeats_yearly);
  const repeatsLabel = el("label", "checkbox-label");
  repeatsLabel.htmlFor = repeatsInput.id;
  repeatsLabel.append(
    repeatsInput,
    document.createTextNode(" This event happens every year"),
  );

  const wrapper = el("div");
  wrapper.append(
    field("Event name", titleInput),
    field("Description", descInput),
    field("Date", dateInput),
    field("Time", timeInput, "For example: 10:00 AM to 6:00 PM"),
    field("Location", locationInput),
    field("Status", statusSelect),
    el("div", "menu-field"),
    openLabel,
    repeatsLabel,
  );

  return {
    wrapper: wrapper,
    read: () => ({
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      date: dateInput.value,
      time: timeInput.value.trim(),
      location: locationInput.value.trim(),
      status: statusSelect.value,
      open: openInput.checked,
      repeats: repeatsInput.checked,
    }),
    reset: () => {
      titleInput.value = "";
      descInput.value = "";
      dateInput.value = "";
      timeInput.value = "";
      locationInput.value = "";
      statusSelect.value = "draft";
      openInput.checked = true;
      repeatsInput.checked = false;
    },
  };
}

function validateEvent(values) {
  if (values.title.length < 3) {
    return "Please enter the event name (at least 3 letters).";
  }

  if (!values.date) {
    return "Please choose the date of the event.";
  }

  return "";
}

function eventParams(id, values) {
  return {
    p_id: id,
    p_title: values.title,
    p_description: values.description,
    p_event_date: values.date,
    p_start_time: values.time,
    p_location: values.location,
    p_status: values.status,
    p_registration_open: values.open,
    p_repeats_yearly: values.repeats,
  };
}

/* ---------- Ticket categories ---------- */
function ticketRow(event, ticket) {
  const row = el("div", "ticket-row");
  const key = "tk-" + event.id + "-" + (ticket ? ticket.id : "new");

  const nameInput = el("input");
  nameInput.id = key + "-name";
  nameInput.type = "text";
  nameInput.maxLength = 60;
  nameInput.placeholder = "Adults";
  nameInput.autocomplete = "off";
  nameInput.value = ticket ? ticket.name : "";

  const priceInput = el("input");
  priceInput.id = key + "-price";
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "0.01";
  priceInput.inputMode = "decimal";
  priceInput.value = ticket ? ticket.price : "";

  const sortInput = el("input");
  sortInput.id = key + "-sort";
  sortInput.type = "number";
  sortInput.min = "0";
  sortInput.max = "9999";
  sortInput.step = "1";
  sortInput.value = ticket ? ticket.sort_order : 100;

  const activeInput = el("input");
  activeInput.id = key + "-active";
  activeInput.type = "checkbox";
  activeInput.checked = ticket ? ticket.active : true;
  const activeLabel = el("label", "checkbox-label");
  activeLabel.htmlFor = activeInput.id;
  activeLabel.append(activeInput, document.createTextNode(" On sale"));

  const save = el("button", "button", ticket ? "Save" : "Add category");
  save.type = "button";
  save.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const price = priceInput.value === "" ? NaN : Number(priceInput.value);
    const sort = sortInput.value === "" ? 100 : Number(sortInput.value);

    if (name.length < 2) {
      setMessage("Please enter the category name, for example Adults.");
      nameInput.focus();
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setMessage("Please enter the ticket price (0 if it is free).");
      priceInput.focus();
      return;
    }

    runAction(
      save,
      () =>
        rpc("staff_save_ticket_type", {
          p_id: ticket ? ticket.id : null,
          p_event_id: event.id,
          p_name: name,
          p_price: price,
          p_sort_order: sort,
          p_active: activeInput.checked,
        }),
      ticket ? name + " saved." : name + " added.",
    );
  });

  row.append(
    field("Category", nameInput),
    field("Price (NLe)", priceInput),
    field("Order", sortInput),
    activeLabel,
    save,
  );

  return row;
}

function ticketSection(event) {
  const box = el("div", "photo-box");
  box.appendChild(el("h4", null, "Ticket categories and prices"));

  if (!event.tickets || event.tickets.length === 0) {
    box.appendChild(el("p", null, "No ticket categories yet."));
  }

  (event.tickets || []).forEach((ticket) =>
    box.appendChild(ticketRow(event, ticket)),
  );

  box.appendChild(el("h4", null, "Add a category"));
  box.appendChild(ticketRow(event, null));

  const others = events.filter(
    (other) =>
      other.id !== event.id && other.tickets && other.tickets.length > 0,
  );

  if (others.length > 0) {
    const select = el("select");
    select.id = "copy-" + event.id;

    others.forEach((other) => {
      const option = el(
        "option",
        null,
        other.title + " (" + longDate(other.event_date) + ")",
      );
      option.value = other.id;
      select.appendChild(option);
    });

    const label = el(
      "label",
      null,
      "Copy categories and prices from another event",
    );
    label.htmlFor = select.id;

    const copy = el("button", "button button-secondary", "Copy categories");
    copy.type = "button";
    copy.addEventListener("click", () => {
      if (
        !window.confirm(
          "Copy the categories and prices into " +
            event.title +
            "? You can change the prices afterwards.",
        )
      ) {
        return;
      }

      runAction(
        copy,
        () =>
          rpc("staff_copy_ticket_types", {
            p_from_event: select.value,
            p_to_event: event.id,
          }),
        "Categories copied. Please check the prices.",
      );
    });

    box.append(label, select, copy);
  }

  return box;
}

/* ---------- Updates ---------- */
function updatesSection(event) {
  const box = el("div", "photo-box");
  box.appendChild(el("h4", null, "Updates people can see"));

  if (!event.updates || event.updates.length === 0) {
    box.appendChild(
      el(
        "p",
        null,
        "No updates yet. Changes to the date, time, location or ticket prices are added here automatically.",
      ),
    );
  } else {
    const list = el("ul");
    event.updates.forEach((update) => {
      list.appendChild(
        el(
          "li",
          null,
          formatDate(update.created_at) +
            ": " +
            update.message +
            (update.automatic ? " (automatic)" : ""),
        ),
      );
    });
    box.appendChild(list);
  }

  if (can("events.manage")) {
    const input = el("textarea");
    input.id = "update-" + event.id;
    input.rows = 2;
    input.maxLength = 500;

    const label = el("label", null, "Post an announcement");
    label.htmlFor = input.id;

    const post = el("button", "button", "Post update");
    post.type = "button";
    post.addEventListener("click", () => {
      const message = input.value.trim();

      if (message.length < 3) {
        setMessage("Please write the announcement.");
        input.focus();
        return;
      }

      runAction(
        post,
        () =>
          rpc("staff_post_event_update", {
            p_event_id: event.id,
            p_message: message,
          }),
        "Update posted.",
      );
    });

    box.append(label, input, post);
  }

  return box;
}

/* ---------- Registrations ---------- */
function registrationCard(registration, info) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, registration.full_name));

  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " +
        (registration.status === "Registered" ? "badge-good" : "badge-bad"),
      registration.status,
    ),
  );
  card.appendChild(badges);

  const phoneParagraph = el("p");
  phoneParagraph.appendChild(el("strong", null, "Phone: "));
  const phoneLink = el("a", null, registration.phone);
  phoneLink.href = "tel:" + String(registration.phone).replace(/[^\d+]/g, "");
  phoneParagraph.appendChild(phoneLink);
  card.appendChild(phoneParagraph);

  addDetail(card, "Registration number:", registration.reg_number || "(old)");
  addDetail(card, "Registered:", formatDate(registration.created_at));

  const list = el("ul");
  (registration.items || []).forEach((item) => {
    list.appendChild(
      el(
        "li",
        null,
        item.quantity + " × " + item.name + " at " + money(item.unit_price),
      ),
    );
  });
  card.appendChild(list);

  addDetail(card, "Total:", money(registration.total_amount));

  if (registration.notes) {
    addDetail(card, "Notes:", registration.notes);
  }

  if (registration.thanked_at) {
    addDetail(
      card,
      "Thank-you message sent:",
      formatDate(registration.thanked_at),
    );
  }

  if (
    can("events.manage") &&
    registration.status === "Ended" &&
    !registration.thanked_at
  ) {
    const link = el("a", "button", "Send thank-you on WhatsApp");
    link.href = whatsappLink(registration, info.event, info.next_event);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.addEventListener("click", async () => {
      try {
        await rpc("staff_mark_thanked", { p_registration_id: registration.id });
        link.textContent = "Sent (marked)";
      } catch (error) {
        setMessage(friendlyError(error));
      }
    });
    card.appendChild(link);
  }

  return card;
}

function registrationsSection(event) {
  const box = el("div", "photo-box");
  box.appendChild(el("h4", null, "Registrations"));
  addDetail(
    box,
    "So far:",
    event.reg_count +
      " registrations, " +
      event.ticket_count +
      " tickets, " +
      money(event.amount_total) +
      " in total",
  );

  const holder = el("div");
  const toggle = el("button", "button button-secondary", "Show registrations");
  toggle.type = "button";

  toggle.addEventListener("click", async () => {
    if (holder.firstChild) {
      holder.textContent = "";
      toggle.textContent = "Show registrations";
      return;
    }

    toggle.disabled = true;

    try {
      const info = await rpc("staff_get_event_registrations", {
        p_event_id: event.id,
      });

      if (!info.registrations || info.registrations.length === 0) {
        holder.appendChild(el("p", null, "Nobody has registered yet."));
      }

      (info.registrations || []).forEach((registration) => {
        holder.appendChild(registrationCard(registration, info));
      });

      toggle.textContent = "Hide registrations";
    } catch (error) {
      setMessage(friendlyError(error));
    }

    toggle.disabled = false;
  });

  box.append(toggle, holder);

  if (can("events.manage") && event.status !== "closed") {
    const endButton = el(
      "button",
      "button button-danger",
      "End this event and all registrations",
    );
    endButton.type = "button";
    endButton.addEventListener("click", () => {
      const question =
        "End " +
        event.title +
        "?\n\nEvery registration will be marked as ended, registration will close, and the event will move to Closed. You can then send each person a thank-you on WhatsApp.\n\nThis cannot be undone.";

      if (!window.confirm(question)) {
        return;
      }

      runAction(
        endButton,
        () => rpc("staff_end_event", { p_event_id: event.id }),
        event.title +
          " has ended. Open the registrations to send the thank-you messages.",
      );
    });
    box.appendChild(endButton);
  }

  return box;
}

/* ---------- Event cards ---------- */
function eventCard(event) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, event.title));

  const badges = el("p");
  badges.appendChild(
    el(
      "span",
      "badge " +
        (event.status === "published"
          ? "badge-good"
          : event.status === "closed"
            ? "badge-bad"
            : "badge-warn"),
      event.status,
    ),
  );
  badges.appendChild(el("span", "badge", longDate(event.event_date)));
  card.appendChild(badges);

  if (can("events.manage")) {
    const fields = eventFields("event-" + event.id, event);
    card.appendChild(fields.wrapper);

    const save = el("button", "button", "Save event details");
    save.type = "button";
    save.addEventListener("click", () => {
      const values = fields.read();
      const problem = validateEvent(values);

      if (problem) {
        setMessage(problem);
        return;
      }

      runAction(
        save,
        () => rpc("staff_save_event", eventParams(event.id, values)),
        event.title + " saved.",
      );
    });
    card.appendChild(save);
  } else {
    addDetail(card, "Time:", event.start_time || "not set");
    addDetail(card, "Location:", event.location || "not set");
  }

  if (can("events.pricing")) {
    card.appendChild(ticketSection(event));
  } else {
    const list = el("ul");
    (event.tickets || []).forEach((ticket) => {
      list.appendChild(
        el("li", null, ticket.name + ": " + money(ticket.price)),
      );
    });
    card.appendChild(list);
  }

  card.appendChild(updatesSection(event));
  card.appendChild(registrationsSection(event));
  return card;
}

function newEventCard() {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, "Add a new event"));

  const fields = eventFields("new-event", {});
  card.appendChild(fields.wrapper);

  const add = el("button", "button", "Add this event");
  add.type = "button";
  add.addEventListener("click", async () => {
    const values = fields.read();
    const problem = validateEvent(values);

    if (problem) {
      setMessage(problem);
      return;
    }

    add.disabled = true;
    setMessage("Adding...");

    try {
      await rpc("staff_save_event", eventParams(null, values));
      fields.reset();
      await loadEvents();
      setMessage(
        values.title +
          " added. Now add its ticket categories and prices, then publish it.",
      );
    } catch (error) {
      console.error("Add event failed:", error);
      setMessage(friendlyError(error));
    }

    add.disabled = false;
  });

  card.appendChild(add);
  return card;
}

function render() {
  newEventBox.textContent = "";

  if (can("events.manage")) {
    newEventBox.appendChild(newEventCard());
  }

  eventList.textContent = "";

  if (events.length === 0) {
    eventList.appendChild(el("p", null, "There are no events yet."));
    return;
  }

  events.forEach((event) => eventList.appendChild(eventCard(event)));
}

async function loadEvents() {
  events = (await rpc("staff_list_events")) || [];
  render();
}

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

refreshButton.addEventListener("click", async () => {
  setMessage("Loading...");

  try {
    await loadEvents();
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

  if (!can("events.view")) {
    goTo("chef-dashboard.html");
    return;
  }

  document.getElementById("nav-menu").hidden = !can("menu.manage");
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

  setMessage("Loading...");

  try {
    await loadEvents();
    setMessage("");
  } catch (loadError) {
    console.error("Load error:", loadError);
    setMessage(friendlyError(loadError));
  }
}

start();
