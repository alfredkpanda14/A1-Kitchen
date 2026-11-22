/* A1 Kitchen: public certificate checker */
const verifyForm = document.getElementById("verify-form");
const verifyInput = document.getElementById("verify-input");
const verifyMessage = document.getElementById("verify-message");
const verifyResult = document.getElementById("verify-result");

const CERT_PATTERN = /CERT-\d{4}-[A-Z0-9]{6}/;

const CATEGORY_LABELS = {
  competition_winner: "Competition Winner",
  participation: "Participation",
  training: "Training Completion",
  employee: "Employee Recognition",
  achievement: "Other Achievement",
};

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

function longDate(dateText) {
  if (!dateText) {
    return "";
  }
  const date = new Date(String(dateText).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(date.getTime())) {
    return String(dateText);
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function prizeText(result) {
  const parts = [];
  const amount = Number(result.prize_amount);
  if (result.prize_currency && amount > 0) {
    const whole = Math.round(amount) === amount;
    parts.push(
      result.prize_currency +
        " " +
        amount.toLocaleString("en-GB", {
          minimumFractionDigits: whole ? 0 : 2,
          maximumFractionDigits: 2,
        }),
    );
  }
  if (result.prize_note) {
    parts.push(result.prize_note);
  }
  return parts.join(" + ");
}

function row(list, label, value) {
  if (!value) {
    return;
  }
  const item = el("div", "cert-row");
  item.appendChild(el("dt", null, label));
  item.appendChild(el("dd", null, value));
  list.appendChild(item);
}

function details(result, full) {
  const list = el("dl", "cert-details");
  row(list, "Certificate holder", result.full_name);
  row(list, "Certificate", result.title);
  if (full) {
    row(
      list,
      "Achievement",
      [result.statement, result.programme].filter(Boolean).join(" "),
    );
  } else {
    row(list, "For", result.programme);
  }
  row(list, "Category", CATEGORY_LABELS[result.category] || "");
  row(list, "Award", result.award);
  row(list, "Achievement date", longDate(result.achievement_date));
  if (full) {
    row(list, "Place", result.location);
    row(list, "Prize", prizeText(result));
  }
  row(list, "Issue date", longDate(result.issue_date));
  row(list, "Certificate number", result.certificate_number);
  row(
    list,
    "Issued by",
    (result.organisation || "Awan Kitchen and Catering Services") +
      " (" +
      (result.brand || "A1 Kitchen") +
      "), Sierra Leone",
  );
  return list;
}

function show(result) {
  const card = el("div", "success-hero cert-result");
  const status = result && result.found ? result.status : "";

  if (status === "VALID") {
    card.classList.add("cert-valid");
    card.appendChild(el("div", "success-check", "✓"));
    card.appendChild(el("p", "cert-status cert-status-valid", "VALID"));
    card.appendChild(el("h2", null, "This certificate is genuine"));
    card.appendChild(
      el(
        "p",
        null,
        "It was issued by A1 Kitchen and is valid. Check that the details below match the printed certificate.",
      ),
    );
    card.appendChild(details(result, true));
  } else if (status === "REVOKED") {
    card.classList.add("cert-revoked");
    card.appendChild(el("div", "success-check fail-check", "✕"));
    card.appendChild(el("p", "cert-status cert-status-revoked", "REVOKED"));
    card.appendChild(el("h2", null, "This certificate is no longer valid"));
    card.appendChild(
      el(
        "p",
        null,
        "A1 Kitchen has cancelled this certificate" +
          (result.revoked_at ? " on " + longDate(result.revoked_at) : "") +
          ". It must not be accepted as proof of the achievement.",
      ),
    );
    card.appendChild(details(result, false));
  } else if (status === "REPLACED") {
    card.classList.add("cert-replaced");
    card.appendChild(el("div", "success-check warn-check", "!"));
    card.appendChild(el("p", "cert-status cert-status-replaced", "REPLACED"));
    card.appendChild(el("h2", null, "A corrected certificate was issued"));
    card.appendChild(
      el(
        "p",
        null,
        "This certificate number is no longer valid because A1 Kitchen issued a corrected certificate in its place.",
      ),
    );
    if (result.replacement_number) {
      const link = el(
        "a",
        "button",
        "Check the new certificate " + result.replacement_number,
      );
      link.href = "#c=" + result.replacement_number;
      card.appendChild(link);
    }
    card.appendChild(details(result, false));
  } else {
    card.classList.add("cert-revoked");
    card.appendChild(el("div", "success-check fail-check", "✕"));
    card.appendChild(el("p", "cert-status cert-status-revoked", "NOT FOUND"));
    card.appendChild(el("h2", null, "We could not find this certificate"));
    card.appendChild(
      el(
        "p",
        null,
        "Please check the number and try again. If you were shown a certificate with this number, it may not be genuine. Contact A1 Kitchen if you have a question.",
      ),
    );
  }
  verifyResult.appendChild(card);
}

async function check(text) {
  const match = String(text || "")
    .toUpperCase()
    .match(CERT_PATTERN);
  verifyResult.textContent = "";
  if (!match) {
    verifyMessage.textContent =
      "Please enter a certificate number like CERT-2026-AB12CD.";
    return;
  }
  verifyInput.value = match[0];
  verifyMessage.textContent = "Checking...";
  try {
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/verify_certificate",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ p_number: match[0] }),
      },
    );
    if (!response.ok) {
      throw new Error("Request failed");
    }
    const result = await response.json();
    verifyMessage.textContent = "";
    show(result);
  } catch (error) {
    console.error("Verify error:", error);
    verifyMessage.textContent =
      "We could not check the certificate. Please check your internet connection and try again.";
  }
}

verifyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  check(verifyInput.value);
});

function fromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const number = params.get("c");
  if (number) {
    check(number);
  }
}

window.addEventListener("hashchange", fromHash);
fromHash();
