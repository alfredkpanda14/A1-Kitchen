const eventsMessage = document.getElementById("events-message");
const eventsList = document.getElementById("events-list");

const EVENT_PERSON_KEY = "a1KitchenEventPerson";
const EVENT_REG_KEY = "a1KitchenEventReg";

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

function money(value) {
  return "NLe " + Number(value || 0);
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

function isValidPhone(value) {
  if (!/^\+?[0-9\s\-()]+$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

async function callRpc(name, params) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params || {}),
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

function savedPerson() {
  try {
    return JSON.parse(localStorage.getItem(EVENT_PERSON_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function friendlyError(error) {
  const text = (error && error.message) || "";

  if (/failed to fetch|networkerror/i.test(text)) {
    return "We could not reach A1 Kitchen. Please check your internet connection and try again.";
  }

  if (text.includes("already registered")) {
    return "This phone number is already registered for this event. If you saved your registration link, open it, or contact A1 Kitchen.";
  }

  if (text.includes("a lot of requests")) {
    return "We are receiving a lot of requests right now. Please try again in a few minutes.";
  }

  if (text.length > 0 && text.length < 120 && !text.includes("invalid input")) {
    return text;
  }

  return "We could not complete your registration. Please try again, or contact A1 Kitchen.";
}

function addLine(parent, label, value) {
  if (!value) {
    return;
  }

  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function registrationForm(event) {
  const wrapper = el("div", "event-form");
  wrapper.appendChild(el("h4", null, "Register"));

  const person = savedPerson();
  const id = "event-" + event.id;

  const nameInput = el("input");
  nameInput.type = "text";
  nameInput.id = id + "-name";
  nameInput.maxLength = 100;
  nameInput.autocomplete = "name";
  nameInput.value = person.name || "";

  const phoneInput = el("input");
  phoneInput.type = "tel";
  phoneInput.id = id + "-phone";
  phoneInput.maxLength = 20;
  phoneInput.autocomplete = "tel";
  phoneInput.inputMode = "tel";
  phoneInput.value = person.phone || "";

  const nameLabel = el("label", null, "Full name *");
  nameLabel.htmlFor = nameInput.id;
  const phoneLabel = el("label", null, "Phone number *");
  phoneLabel.htmlFor = phoneInput.id;

  wrapper.append(nameLabel, nameInput, phoneLabel, phoneInput);

  wrapper.appendChild(el("p", null, "How many tickets of each kind?"));

  const quantityInputs = [];
  const totalLine = el("p", "menu-notice", "Total: " + money(0));

  function updateTotal() {
    let total = 0;

    quantityInputs.forEach((entry) => {
      const quantity = Number(entry.input.value) || 0;
      total += quantity * Number(entry.ticket.price);
    });

    totalLine.textContent = "Total: " + money(total);
  }

  event.tickets.forEach((ticket) => {
    const input = el("input");
    input.type = "number";
    input.id = id + "-ticket-" + ticket.id;
    input.min = "0";
    input.max = "20";
    input.step = "1";
    input.value = "0";
    input.inputMode = "numeric";
    input.addEventListener("input", updateTotal);

    const label = el(
      "label",
      null,
      ticket.name + " (" + money(ticket.price) + " each)",
    );
    label.htmlFor = input.id;

    quantityInputs.push({ ticket: ticket, input: input });
    wrapper.append(label, input);
  });

  const notesLabel = el("label", null, "Additional information");
  const notesInput = el("textarea");
  notesInput.id = id + "-notes";
  notesInput.rows = 3;
  notesInput.maxLength = 500;
  notesLabel.htmlFor = notesInput.id;

  const message = el("p", "success-message");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  const submit = el("button", "button", "Register");
  submit.type = "button";

  let busy = false;

  submit.addEventListener("click", async () => {
    if (busy) {
      return;
    }

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (name.length < 2) {
      message.textContent = "Please enter your full name.";
      nameInput.focus();
      return;
    }

    if (!isValidPhone(phone)) {
      message.textContent =
        "Please enter a valid phone number, for example +232 79 123456.";
      phoneInput.focus();
      return;
    }

    const items = [];
    let count = 0;

    for (const entry of quantityInputs) {
      const quantity = Number(entry.input.value) || 0;

      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
        message.textContent =
          "Please choose between 0 and 20 tickets of each kind.";
        entry.input.focus();
        return;
      }

      if (quantity > 0) {
        items.push({ ticket_type_id: entry.ticket.id, quantity: quantity });
        count += quantity;
      }
    }

    if (count < 1 || count > 20) {
      message.textContent = "Please choose between 1 and 20 tickets in total.";
      return;
    }

    busy = true;
    submit.disabled = true;
    message.textContent = "Registering...";

    try {
      const result = await callRpc("register_for_event", {
        p_event_id: event.id,
        p_full_name: name,
        p_phone: phone,
        p_items: items,
        p_notes: notesInput.value.trim() || null,
      });

      localStorage.setItem(
        EVENT_PERSON_KEY,
        JSON.stringify({ name: name, phone: phone }),
      );
      localStorage.setItem(
        EVENT_REG_KEY,
        JSON.stringify({
          reg_number: result.reg_number,
          access_code: result.access_code,
        }),
      );

      window.location.href =
        "my-registration.html#r=" +
        encodeURIComponent(result.reg_number) +
        "&t=" +
        encodeURIComponent(result.access_code);
    } catch (error) {
      console.error("Event registration error:", error);
      message.textContent = friendlyError(error);
      busy = false;
      submit.disabled = false;
    }
  });

  wrapper.append(notesLabel, notesInput, totalLine, submit, message);
  return wrapper;
}

function eventCard(event) {
  const card = el("div", "card order-card");
  card.appendChild(el("h3", null, event.title));

  addLine(card, "Date:", longDate(event.event_date));
  addLine(card, "Time:", event.start_time);
  addLine(card, "Where:", event.location);

  if (event.description) {
    card.appendChild(el("p", null, event.description));
  }

  if (event.updates && event.updates.length > 0) {
    card.appendChild(el("h4", null, "Latest updates"));
    const list = el("ul");

    event.updates.forEach((update) => {
      list.appendChild(el("li", null, update.message));
    });

    card.appendChild(list);
  }

  if (event.tickets && event.tickets.length > 0) {
    card.appendChild(el("h4", null, "Tickets"));
    const list = el("ul");

    event.tickets.forEach((ticket) => {
      list.appendChild(
        el("li", null, ticket.name + ": " + money(ticket.price)),
      );
    });

    card.appendChild(list);
  }

  if (!event.registration_open) {
    card.appendChild(
      el("p", "menu-notice", "Registration for this event is closed."),
    );
  } else if (!event.tickets || event.tickets.length === 0) {
    card.appendChild(
      el(
        "p",
        "menu-notice",
        "Ticket prices will be announced soon. Please check back.",
      ),
    );
  } else {
    card.appendChild(registrationForm(event));
  }

  return card;
}

function showSavedLink() {
  let saved = null;

  try {
    saved = JSON.parse(localStorage.getItem(EVENT_REG_KEY));
  } catch (error) {
    saved = null;
  }

  if (!saved || !saved.reg_number || !saved.access_code) {
    return;
  }

  const paragraph = el("p");
  const link = el("a", "button button-secondary", "Open my registration");
  link.href =
    "my-registration.html#r=" +
    encodeURIComponent(saved.reg_number) +
    "&t=" +
    encodeURIComponent(saved.access_code);
  paragraph.appendChild(link);
  eventsList.before(paragraph);
}

async function loadEvents() {
  eventsMessage.textContent = "Loading events...";

  try {
    const events = await callRpc("get_public_events", {});
    eventsMessage.textContent = "";
    eventsList.textContent = "";

    if (!events || events.length === 0) {
      eventsList.appendChild(
        el(
          "p",
          null,
          "There are no upcoming events right now. Please check back soon.",
        ),
      );
      return;
    }

    events.forEach((event) => eventsList.appendChild(eventCard(event)));
  } catch (error) {
    console.error("Events load error:", error);
    eventsMessage.textContent =
      "We could not load the events. Please check your internet connection and try again.";
  }
}

showSavedLink();
loadEvents();
