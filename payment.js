const orderData = JSON.parse(localStorage.getItem("a1KitchenCurrentOrder"));

const orderNumber = document.getElementById("payment-order-number");
const paymentTotal = document.getElementById("payment-total");
const paymentMethod = document.getElementById("payment-method");
const paymentInstructions = document.getElementById("payment-instructions");
const paymentForm = document.getElementById("payment-form");

if (!orderData) {
  orderNumber.textContent = "No current order found.";
  paymentTotal.textContent = "0";
} else {
  orderNumber.textContent = orderData.order_number;
  paymentTotal.textContent = orderData.total;
}

function addParagraph(text, bold) {
  const paragraph = document.createElement("p");
  if (bold) {
    const strong = document.createElement("strong");
    strong.textContent = text;
    paragraph.appendChild(strong);
  } else {
    paragraph.textContent = text;
  }
  paymentInstructions.appendChild(paragraph);
}

function showInstructions(method) {
  paymentInstructions.innerHTML = "";

  if (!method) {
    return;
  }

  let number = "";
  let accountName = "";

  if (method === "Orange Money") {
    number = SITE_INFO.orangeMoneyNumber;
    accountName = SITE_INFO.orangeMoneyName;
  } else if (method === "Afrimoney") {
    number = SITE_INFO.afrimoneyNumber;
    accountName = SITE_INFO.afrimoneyName;
  }

  const title = document.createElement("h3");
  title.textContent = method;
  paymentInstructions.appendChild(title);

  if (number) {
    addParagraph("Send the exact total to this official A1 Kitchen number:");
    addParagraph(number, true);
    if (accountName) {
      addParagraph("Account name: " + accountName);
    }
    addParagraph("Use your order number as the reference if possible.");
    addParagraph(
      "After paying, take a screenshot of the payment confirmation and upload it on the next page.",
    );
  } else {
    addParagraph(
      "The official A1 Kitchen " +
        method +
        " number will be added here when supplied.",
      true,
    );
    if (SITE_INFO.phone) {
      addParagraph(
        "Please contact A1 Kitchen on " +
          SITE_INFO.phone +
          " for payment details.",
      );
    }
  }

  addParagraph("Do not send payment to an unverified number.");
  addParagraph("A1 Kitchen will never ask for your PIN or password.");
}

paymentMethod.addEventListener("change", () => {
  showInstructions(paymentMethod.value);
});

paymentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!paymentMethod.value) {
    alert("Please select Orange Money or Afrimoney.");
    return;
  }

  localStorage.setItem("a1KitchenPaymentMethod", paymentMethod.value);
  window.location.href = "payment-proof.html";
});
