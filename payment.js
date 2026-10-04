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

paymentMethod.addEventListener("change", () => {
  if (paymentMethod.value === "Orange Money") {
    paymentInstructions.innerHTML = `
        <h3>Orange Money</h3>

        <p>
          Please contact A1 Kitchen
          or follow the payment instructions
          provided by the Head Chef.
        </p>

        <p>
          <strong>
            The official A1 Kitchen
            Orange Money number will
            be added here when supplied.
          </strong>
        </p>

        <p>
          Do not send payment to an
          unverified number.
        </p>
      `;
  }

  if (paymentMethod.value === "Afrimoney") {
    paymentInstructions.innerHTML = `
        <h3>Afrimoney</h3>

        <p>
          Please contact A1 Kitchen
          or follow the payment instructions
          provided by the Head Chef.
        </p>

        <p>
          <strong>
            The official A1 Kitchen
            Afrimoney number will
            be added here when supplied.
          </strong>
        </p>

        <p>
          Do not send payment to an
          unverified number.
        </p>
      `;
  }
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
