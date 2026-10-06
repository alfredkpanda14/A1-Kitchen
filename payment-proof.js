const proofForm = document.getElementById("proof-form");
const proofResult = document.getElementById("proof-result");
const orderNumberElement = document.getElementById("proof-order-number");
const paymentMethodElement = document.getElementById("proof-payment-method");
const submitButton = proofForm.querySelector('button[type="submit"]');

const orderNumber = localStorage.getItem("a1KitchenOrderNumber");
const customerToken = localStorage.getItem("a1KitchenCustomerToken");
const paymentMethod = localStorage.getItem("a1KitchenPaymentMethod");

const extensionByType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

orderNumberElement.textContent = orderNumber || "Not found";
paymentMethodElement.textContent = paymentMethod || "Not selected";

proofForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!orderNumber || !customerToken) {
    proofResult.textContent = "Your order information could not be found.";
    return;
  }

  if (!paymentMethod) {
    proofResult.textContent = "Please select a payment method first.";
    return;
  }

  const file = document.getElementById("payment-screenshot").files[0];

  if (!file) {
    proofResult.textContent = "Please select your payment screenshot.";
    return;
  }

  const extension = extensionByType[file.type];

  if (!extension) {
    proofResult.textContent = "Please upload a JPG, PNG or WebP image.";
    return;
  }

  if (file.size > 6 * 1024 * 1024) {
    proofResult.textContent =
      "The screenshot is too large. Please use an image below 6 MB.";
    return;
  }

  submitButton.disabled = true;
  proofResult.textContent = "Uploading your payment screenshot...";

  const filePath = `${orderNumber}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("payment-proof")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    proofResult.textContent =
      "The screenshot could not be uploaded. Please try again.";
    submitButton.disabled = false;
    return;
  }

  const { error: proofError } = await supabaseClient.rpc(
    "submit_payment_proof",
    {
      p_order_number: orderNumber,
      p_customer_token: customerToken,
      p_payment_method: paymentMethod,
      p_screenshot_path: filePath,
    },
  );

  if (proofError) {
    console.error("Payment proof error:", proofError);
    proofResult.textContent =
      "The screenshot was uploaded, but we could not record it. " +
      "Please contact A1 Kitchen with your order number.";
    submitButton.disabled = false;
    return;
  }

  proofResult.textContent =
    "Payment screenshot submitted successfully. " +
    "Your payment is now awaiting verification.";
  proofForm.reset();
});
