/* ==========================================================
   Extra staff tools: new-activity alerts and allowed numbers
   (uses helper functions from chef-dashboard.js)
   ========================================================== */

/* ---------- Page elements ---------- */
const alertBanner = document.getElementById("alert-banner");
const alertText = document.getElementById("alert-text");
const alertShow = document.getElementById("alert-show");
const alertDismiss = document.getElementById("alert-dismiss");
const alertSound = document.getElementById("alert-sound");
const alertAwake = document.getElementById("alert-awake");

const limitsView = document.getElementById("limits-view");
const limitsList = document.getElementById("limits-list");
const limitPhone = document.getElementById("limit-phone");
const limitHours = document.getElementById("limit-hours");
const limitReason = document.getElementById("limit-reason");
const limitAdd = document.getElementById("limit-add");

/* ---------- New-activity alerts (free; work while this page is open) ---------- */
const ALERT_CHECK_MS = 60000;
const ALERT_ORIGINAL_TITLE = document.title;

let alertLast = null;
let alertAudio = null;
let alertWakeLock = null;
let alertTarget = null;

function alertTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function alertUnlockSound() {
  try {
    if (!alertAudio) {
      alertAudio = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (alertAudio.state === "suspended") {
      alertAudio.resume();
    }
  } catch (error) {
    console.error("Sound could not start:", error);
  }
}

function alertBeep() {
  if (!alertSound.checked) {
    return;
  }

  alertUnlockSound();

  try {
    [0, 0.35, 0.7].forEach((offset) => {
      const start = alertAudio.currentTime + offset;
      const oscillator = alertAudio.createOscillator();
      const gain = alertAudio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);

      oscillator.connect(gain);
      gain.connect(alertAudio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  } catch (error) {
    console.error("Sound failed:", error);
  }

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

function alertHide() {
  alertBanner.hidden = true;
  document.title = ALERT_ORIGINAL_TITLE;
}

function alertShowBanner(parts, target) {
  alertText.textContent = "New: " + parts.join(", ") + ".";
  alertTarget = target;
  alertBanner.hidden = false;
  document.title = "(New) " + ALERT_ORIGINAL_TITLE;
  alertBeep();
}

function alertCompare(now, before) {
  const parts = [];
  let target = null;

  if (alertTime(now.latest_order) > alertTime(before.latest_order)) {
    parts.push("order request");
    target = target || { view: "orders", tab: "needs-price" };
  }

  if (alertTime(now.latest_proof) > alertTime(before.latest_proof)) {
    parts.push("payment screenshot to check");
    target = target || { view: "orders", tab: "payments" };
  }

  if (alertTime(now.latest_catering) > alertTime(before.latest_catering)) {
    parts.push("catering request");
    target = target || { view: "catering" };
  }

  if (alertTime(now.latest_problem) > alertTime(before.latest_problem)) {
    parts.push("problem report");
    target = target || { view: "problems" };
  }

  return { parts: parts, target: target };
}

async function alertCheck() {
  try {
    const now = await rpc("staff_latest_activity");

    if (!now) {
      return;
    }

    if (alertLast) {
      const result = alertCompare(now, alertLast);

      if (result.parts.length > 0) {
        alertShowBanner(result.parts, result.target);
      }
    }

    alertLast = now;
  } catch (error) {
    // A weak connection just means we try again in a minute
    console.error("Alert check failed:", error);
  }
}

async function alertSetAwake(on) {
  try {
    if (on && "wakeLock" in navigator) {
      alertWakeLock = await navigator.wakeLock.request("screen");
    } else if (alertWakeLock) {
      await alertWakeLock.release();
      alertWakeLock = null;
    }
  } catch (error) {
    alertAwake.checked = false;
    localStorage.setItem("a1KitchenAlertAwake", "no");
    setMessage("This device would not keep the screen awake.");
  }
}

async function alertGoToTarget() {
  const target = alertTarget;
  alertHide();

  if (!target) {
    return;
  }

  if (target.view === "orders" && target.tab) {
    currentOrderTab = target.tab;
  }

  await showView(target.view);
}

function startAlerts() {
  alertSound.checked = localStorage.getItem("a1KitchenAlertSound") === "yes";
  alertAwake.checked = localStorage.getItem("a1KitchenAlertAwake") === "yes";

  alertSound.addEventListener("change", () => {
    localStorage.setItem(
      "a1KitchenAlertSound",
      alertSound.checked ? "yes" : "no",
    );

    if (alertSound.checked) {
      alertBeep(); // lets you hear it, and lets the browser allow sound
    }
  });

  alertAwake.addEventListener("change", () => {
    localStorage.setItem(
      "a1KitchenAlertAwake",
      alertAwake.checked ? "yes" : "no",
    );
    alertSetAwake(alertAwake.checked);
  });

  alertShow.addEventListener("click", alertGoToTarget);
  alertDismiss.addEventListener("click", alertHide);

  // Browsers only allow sound after a tap on the page
  document.addEventListener("click", alertUnlockSound, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (alertAwake.checked && !alertWakeLock) {
        alertSetAwake(true);
      }

      alertCheck();
    }
  });

  if (alertAwake.checked) {
    alertSetAwake(true);
  }

  alertCheck();
  setInterval(alertCheck, ALERT_CHECK_MS);
}

/* ---------- Allowed numbers ---------- */
function renderLimits(rows) {
  limitsList.textContent = "";

  if (!rows || rows.length === 0) {
    limitsList.appendChild(
      el("p", null, "No numbers are currently allowed extra requests."),
    );
    return;
  }

  rows.forEach((row) => {
    const card = el("div", "card order-card");
    card.appendChild(el("h3", null, row.phone));
    addDetail(card, "Allowed until:", formatDate(row.expires_at));

    if (row.reason) {
      addDetail(card, "Reason:", row.reason);
    }

    addDetail(card, "Allowed by:", row.created_by || "");

    const removeButton = el(
      "button",
      "button button-danger",
      "Restrict again now",
    );
    removeButton.type = "button";
    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;

      try {
        await rpc("staff_remove_exemption", { p_id: row.id });
        await loadLimits();
        setMessage(row.phone + " is restricted again.");
      } catch (error) {
        setMessage(friendlyError(error));
        removeButton.disabled = false;
      }
    });

    card.appendChild(removeButton);
    limitsList.appendChild(card);
  });
}

async function loadLimits() {
  try {
    renderLimits(await rpc("staff_list_exemptions"));
  } catch (error) {
    setMessage(friendlyError(error));
  }
}

limitAdd.addEventListener("click", async () => {
  const phone = limitPhone.value.trim();

  if (phone.replace(/\D/g, "").length < 8) {
    setMessage("Please enter the customer's phone number.");
    limitPhone.focus();
    return;
  }

  limitAdd.disabled = true;
  setMessage("Working...");

  try {
    await rpc("staff_add_exemption", {
      p_phone: phone,
      p_hours: Number(limitHours.value),
      p_reason: limitReason.value.trim() || null,
    });

    limitPhone.value = "";
    limitReason.value = "";
    await loadLimits();
    setMessage(
      phone +
        " can now make more requests for " +
        limitHours.value +
        " hour(s).",
    );
  } catch (error) {
    console.error("Allow failed:", error);
    setMessage(friendlyError(error));
  }

  limitAdd.disabled = false;
});
