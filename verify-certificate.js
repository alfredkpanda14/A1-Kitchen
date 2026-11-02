/* A1 Kitchen: public certificate checker */
const verifyForm = document.getElementById("verify-form");
const verifyInput = document.getElementById("verify-input");
const verifyMessage = document.getElementById("verify-message");
const verifyResult = document.getElementById("verify-result");

const CERT_PATTERN = /CERT-\d{4}-[A-Z0-9]{6}/;

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

function line(parent, label, value) {
  if (!value) {
    return;
  }
  const paragraph = el("p");
  paragraph.appendChild(el("strong", null, label + " "));
  paragraph.appendChild(document.createTextNode(value));
  parent.appendChild(paragraph);
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
    const card = el("div", "success-hero");
    if (result && result.valid) {
      card.appendChild(el("div", "success-check", "✓"));
      card.appendChild(el("h2", null, "This certificate is genuine"));
      const placeText = Number(result.place) === 1 ? "1st place" : "2nd place";
      card.appendChild(
        el(
          "p",
          null,
          result.full_name +
            " took part in the " +
            result.title +
            " and won " +
            placeText +
            ".",
        ),
      );
      line(card, "Certificate number:", result.certificate_number);
      line(card, "Competition:", result.title);
      line(card, "Date:", longDate(result.event_date));
      line(card, "Place:", result.location);
      line(card, "Result:", placeText);
      line(card, "Prize:", result.prize);
      card.appendChild(
        el(
          "p",
          "field-help",
          "Issued by A1 Kitchen (Awan Kitchen and Catering Services), Sierra Leone.",
        ),
      );
    } else {
      card.appendChild(el("div", "success-check fail-check", "✕"));
      card.appendChild(el("h2", null, "We could not find this certificate"));
      card.appendChild(
        el(
          "p",
          null,
          "Please check the number. If you think this certificate is real, contact A1 Kitchen.",
        ),
      );
    }
    verifyResult.appendChild(card);
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

const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const fromLink = params.get("c");
if (fromLink) {
  verifyInput.value = fromLink.toUpperCase();
  check(fromLink);
}
