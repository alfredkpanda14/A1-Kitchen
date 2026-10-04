const confirmationForm = document.getElementById("delivery-confirmation-form");

const confirmationResult = document.getElementById("confirmation-result");

const problemForm = document.getElementById("problem-form");

const problemResult = document.getElementById("problem-result");

confirmationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const orderNumber = document.getElementById("order-number").value.trim();

  const customerToken = document.getElementById("customer-token").value.trim();

  const { data, error } = await supabaseClient
    .from("orders")
    .update({
      order_status: "Delivered — Customer Confirmed",

      customer_confirmed_at: new Date().toISOString(),
    })
    .eq("order_number", orderNumber)
    .eq("customer_token", customerToken)
    .eq("order_status", "Delivered — Customer Confirmation Pending")
    .select();

  if (error || !data.length) {
    confirmationResult.textContent =
      "We could not confirm this order. Check your details.";

    return;
  }

  confirmationResult.textContent =
    "Thank you. Your delivery has been confirmed.";
});

problemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const orderNumber = document.getElementById("problem-order").value.trim();

  const customerToken = document.getElementById("problem-token").value.trim();

  const details = document.getElementById("problem-details").value.trim();

  const { data: order, error: orderError } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber)
    .eq("customer_token", customerToken)
    .single();

  if (orderError || !order) {
    problemResult.textContent = "We could not verify this order.";

    return;
  }

  const { error } = await supabaseClient.from("problem_reports").insert({
    order_id: order.id,

    customer_token: customerToken,

    details: details,
  });

  if (error) {
    console.error(error);

    problemResult.textContent = "The problem report could not be submitted.";

    return;
  }

  problemResult.textContent =
    "Your problem report has been submitted to A1 Kitchen.";

  problemForm.reset();
});
