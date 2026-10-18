/* A1 Kitchen: Gate and serving-area scanner (event tickets and food tickets) */
const welcome = document.getElementById("welcome");
const gateMessage = document.getElementById("gate-message");
const signOutButton = document.getElementById("signout-button");
const scanStart = document.getElementById("scan-start");
const scanStop = document.getElementById("scan-stop");
const scanVideo = document.getElementById("scan-video");
const ticketInput = document.getElementById("ticket-input");
const ticketCheck = document.getElementById("ticket-check");
const resultBox = document.getElementById("gate-result-box");

const TICKET_PATTERN = /(?:A1|F)-\d{4}-[A-Z0-9]{6}/;

let staff = null;
let stream = null;
let scanning = false;
let detector = null;
let lastTicket = "";

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
  gateMessage.textContent = text || "";
}

function can(permission) {
  return Boolean(staff && staff.permissions.includes(permission));
}

function goTo(page) {
  window.location.href = page;
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

function buzz(good) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(good ? 120 : [200, 100, 200]);
    }
  } catch (error) {
    /* not every phone can vibrate */
  }
}

/* ---------- Event ticket result ---------- */

const LOOKS = {
  valid: ["gate-result-valid", "VALID: ADMIT"],
  balance_due: ["gate-result-warn", "BALANCE NOT PAID"],
  used: ["gate-result-bad", "ALREADY ENTERED"],
  ended: ["gate-result-bad", "REGISTRATION ENDED"],
  not_found: ["gate-result-bad", "TICKET NOT FOUND"],
};

function line(parent, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
}

function showResult(result) {
  resultBox.textContent = "";
  const look = LOOKS[result.status] || LOOKS.not_found;
  const card = el("div", "gate-result " + look[0]);
  card.appendChild(el("p", "gate-status", look[1]));
  if (result.message) {
    card.appendChild(el("p", null, result.message));
  }
  buzz(result.status === "valid");

  if (result.status !== "not_found") {
    line(
      card,
      "Ticket:",
      result.ticket_number +
        (result.is_balance_ticket ? " (balance ticket)" : ""),
    );
    line(card, "Holder:", result.holder);
    line(
      card,
      "Event:",
      result.event_title + " (" + longDate(result.event_date) + ")",
    );
    const list = el("ul");
    (result.items || []).forEach((item) => {
      list.appendChild(el("li", null, item.quantity + " × " + item.name));
    });
    card.appendChild(list);
    line(card, "Admits:", result.tickets + " people");
    line(card, "Already entered:", String(result.admitted));
    line(card, "Still to enter:", String(result.remaining));
    if (result.wrong_day) {
      card.appendChild(
        el(
          "p",
          "duplicate-warning",
          "This ticket is for a different day: " +
            longDate(result.event_date) +
            ".",
        ),
      );
    }
    if (Number(result.balance) > 0) {
      card.appendChild(
        el(
          "p",
          "duplicate-warning",
          "Balance still to pay: NLe " + Number(result.balance),
        ),
      );
    }

    if (
      (result.status === "valid" || result.status === "balance_due") &&
      result.remaining > 0
    ) {
      const input = el("input");
      input.id = "admit-count";
      input.type = "number";
      input.min = "1";
      input.max = String(result.remaining);
      input.step = "1";
      input.inputMode = "numeric";
      input.value = String(result.remaining);
      const label = el("label", null, "How many people are entering now?");
      label.htmlFor = input.id;
      const admit = el("button", "button", "Admit");
      admit.type = "button";
      admit.addEventListener("click", async () => {
        const count = Number(input.value);
        if (!Number.isInteger(count) || count < 1 || count > result.remaining) {
          say("Please enter a number from 1 to " + result.remaining + ".");
          return;
        }
        admit.disabled = true;
        say("Working...");
        try {
          await rpc("staff_admit_entries", {
            p_registration_id: result.registration_id,
            p_count: count,
          });
          say(count + (count === 1 ? " person" : " people") + " admitted.");
          await check(result.ticket_number, true);
        } catch (error) {
          say(friendlyError(error));
          admit.disabled = false;
        }
      });
      card.append(label, input, admit);
    }
  }

  addNextButton(card);
  resultBox.appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addNextButton(card) {
  const next = el("button", "button button-secondary", "Scan the next ticket");
  next.type = "button";
  next.addEventListener("click", () => {
    resultBox.textContent = "";
    say("");
    ticketInput.value = "";
    if (detector) {
      startScan();
    } else {
      ticketInput.focus();
    }
  });
  card.appendChild(next);
}

/* ---------- Food tickets (catering events) ---------- */

const FOOD_LOOKS = {
  valid: ["gate-result-valid", "VALID: SERVE"],
  used: ["gate-result-bad", "ALREADY SERVED"],
  not_approved: ["gate-result-bad", "NOT VALID: DO NOT SERVE"],
  not_found: ["gate-result-bad", "TICKET NOT FOUND"],
};

function showFoodResult(result) {
  resultBox.textContent = "";
  const look = FOOD_LOOKS[result.status] || FOOD_LOOKS.not_found;
  const card = el("div", "gate-result " + look[0]);
  card.appendChild(el("p", "gate-status", look[1]));
  if (result.message) {
    card.appendChild(el("p", null, result.message));
  }
  buzz(result.status === "valid");

  if (result.status !== "not_found") {
    card.appendChild(el("p", "gate-status", result.meal));
    line(card, "Ticket:", result.ticket_number);
    line(card, "Guest:", result.guest_name);
    line(
      card,
      "Event:",
      result.event_title + " (" + longDate(result.event_date) + ")",
    );
    line(card, "Serving:", "1 meal");
    if (result.used_at) {
      line(
        card,
        "Served at:",
        new Date(result.used_at).toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      );
    }
    if (result.wrong_day) {
      card.appendChild(
        el(
          "p",
          "duplicate-warning",
          "This ticket is for a different day: " +
            longDate(result.event_date) +
            ".",
        ),
      );
    }
    if (result.status === "valid") {
      const serve = el(
        "button",
        "button",
        result.wrong_day ? "Serve anyway (different day)" : "Serve this meal",
      );
      serve.type = "button";
      serve.addEventListener("click", async () => {
        if (
          result.wrong_day &&
          !window.confirm(
            "This ticket is for a different day. Serve it anyway?",
          )
        ) {
          return;
        }
        serve.disabled = true;
        say("Working...");
        try {
          await rpc("staff_redeem_food_ticket", {
            p_ticket: result.ticket_number,
          });
          say(result.meal + " served to " + result.guest_name + ".");
          await check(result.ticket_number, true);
        } catch (error) {
          say(friendlyError(error));
          serve.disabled = false;
        }
      });
      card.appendChild(serve);
    }
  }
  addNextButton(card);
  resultBox.appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function check(ticket, quiet) {
  const match = String(ticket || "")
    .toUpperCase()
    .match(TICKET_PATTERN);
  if (!match) {
    say(
      "That does not look like an A1 Kitchen ticket number. It looks like A1-2026-3F9A1C or F-2026-3F9A1C.",
    );
    return;
  }
  lastTicket = match[0];
  if (!quiet) {
    say("Checking...");
  }
  try {
    if (lastTicket.startsWith("F-")) {
      const food = await rpc("staff_verify_food_ticket", {
        p_ticket: lastTicket,
      });
      if (!quiet) {
        say("");
      }
      showFoodResult(food);
      return;
    }
    const result = await rpc("staff_verify_ticket", { p_ticket: lastTicket });
    if (!quiet) {
      say("");
    }
    showResult(result);
  } catch (error) {
    console.error("Verify failed:", error);
    say(friendlyError(error));
  }
}

/* ---------- Camera scanning ---------- */

function stopScan() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  scanVideo.srcObject = null;
  scanVideo.hidden = true;
  scanStop.hidden = true;
  scanStart.hidden = false;
}

async function scanLoop() {
  if (!scanning) {
    return;
  }
  try {
    const codes = await detector.detect(scanVideo);
    if (codes && codes.length > 0) {
      const match = String(codes[0].rawValue || "")
        .toUpperCase()
        .match(TICKET_PATTERN);
      if (match) {
        stopScan();
        ticketInput.value = match[0];
        await check(match[0]);
        return;
      }
    }
  } catch (error) {
    /* keep trying */
  }
  setTimeout(scanLoop, 250);
}

async function startScan() {
  if (
    !("BarcodeDetector" in window) ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    say(
      "This phone's browser cannot scan inside the page. Use the normal camera app to scan the QR code. It will open the ticket here. You can also type the ticket number.",
    );
    return;
  }
  try {
    detector = new BarcodeDetector({ formats: ["qr_code"] });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    scanVideo.srcObject = stream;
    await scanVideo.play();
    scanVideo.hidden = false;
    scanStart.hidden = true;
    scanStop.hidden = false;
    scanning = true;
    say("Point the camera at the QR code on the ticket.");
    scanLoop();
  } catch (error) {
    console.error("Camera error:", error);
    stopScan();
    say(
      "The camera could not start. Please allow camera access for this website, or type the ticket number.",
    );
  }
}

/* ---------- Start ---------- */

scanStart.addEventListener("click", startScan);
scanStop.addEventListener("click", () => {
  stopScan();
  say("");
});
ticketCheck.addEventListener("click", () => check(ticketInput.value));
ticketInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    check(ticketInput.value);
  }
});
signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  goTo("staff-login.html");
});

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
  if (!can("events.view") && !can("cevents.serve")) {
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

  // A ticket scanned with the phone's normal camera arrives as #t=TICKET
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromLink = params.get("t");
  if (fromLink) {
    ticketInput.value = fromLink.toUpperCase();
    check(fromLink);
  }
}

start();
