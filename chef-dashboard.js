const ordersContainer = document.getElementById("chef-orders");

async function loadChefOrders() {
  ordersContainer.innerHTML = "<p>Loading orders...</p>";

  const { data, error } = await supabaseClient
    .from("orders")
    .select(
      `
      id,
      order_number,
      delivery_method,
      delivery_location,
      delivery_notes,
      order_notes,
      subtotal,
      total,
      payment_method,
      payment_status,
      order_status,
      created_at,
      customers (
        full_name,
        phone,
        whatsapp
      ),
      order_items (
        item_name,
        quantity,
        unit_price,
        line_total
      ),
      payment_proofs (
        id,
        payment_method,
        screenshot_path,
        status,
        created_at
      )
    `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(error);

    ordersContainer.innerHTML = "<p>Unable to load orders.</p>";

    return;
  }

  if (!data.length) {
    ordersContainer.innerHTML = "<p>No orders found.</p>";

    return;
  }

  ordersContainer.innerHTML = data
    .map((order) => {
      const items = order.order_items
        .map((item) => `${item.item_name} × ${item.quantity}`)
        .join(", ");

      return `

          <article class="card">

            <h3>
              ${order.order_number}
            </h3>

            <p>
              <strong>Customer:</strong>
              ${order.customers?.full_name || ""}
            </p>

            <p>
              <strong>Phone:</strong>
              ${order.customers?.phone || ""}
            </p>

            <p>
              <strong>Items:</strong>
              ${items}
            </p>

            <p>
              <strong>Total:</strong>
              NLe ${order.total}
            </p>

            <p>
              <strong>Delivery:</strong>
              ${order.delivery_method}
            </p>

            <p>
              <strong>Location:</strong>
              ${order.delivery_location || "Pickup"}
            </p>

            <p>
              <strong>Payment:</strong>
              ${order.payment_status}
            </p>

            <p>
              <strong>Order Status:</strong>
              ${order.order_status}
            </p>


            ${
              order.payment_proofs?.length
                ? `
                <p>
                  <strong>
                    Payment proof submitted.
                  </strong>
                </p>
              `
                : ""
            }


            <button
              class="button"
              onclick="updateOrderStatus(
                '${order.id}',
                'Preparing'
              )"
            >
              Preparing
            </button>


            <button
              class="button"
              onclick="updateOrderStatus(
                '${order.id}',
                'Out for Delivery'
              )"
            >
              Out for Delivery
            </button>


            <button
              class="button"
              onclick="updateOrderStatus(
                '${order.id}',
                'Delivered — Customer Confirmation Pending'
              )"
            >
              Mark Delivered
            </button>

          </article>

        `;
    })
    .join("");
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabaseClient
    .from("orders")
    .update({
      order_status: status,
    })
    .eq("id", orderId);

  if (error) {
    console.error(error);

    alert("The order status could not be updated.");

    return;
  }

  loadChefOrders();
}

document
  .getElementById("refresh-orders")
  .addEventListener("click", loadChefOrders);

loadChefOrders();
