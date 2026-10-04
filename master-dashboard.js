const summary = document.getElementById("dashboard-summary");

const recentOrders = document.getElementById("recent-orders");

async function loadDashboard() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("order_number,total,payment_status,order_status,created_at")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(error);

    summary.innerHTML = "<p>Dashboard data could not be loaded.</p>";

    return;
  }

  const totalOrders = data.length;

  const pendingPayment = data.filter(
    (order) =>
      order.payment_status === "Order Made — Payment Pending" ||
      order.payment_status === "Payment Proof Submitted — Verification Pending",
  ).length;

  const paid = data.filter(
    (order) => order.payment_status === "Payment Verified",
  ).length;

  const delivered = data.filter((order) =>
    order.order_status.includes("Delivered"),
  ).length;

  const revenue = data
    .filter((order) => order.payment_status === "Payment Verified")
    .reduce((total, order) => total + Number(order.total), 0);

  summary.innerHTML = `

    <div class="card">

      <h3>
        Total Orders
      </h3>

      <p>
        ${totalOrders}
      </p>

    </div>


    <div class="card">

      <h3>
        Pending Payment
      </h3>

      <p>
        ${pendingPayment}
      </p>

    </div>


    <div class="card">

      <h3>
        Paid Orders
      </h3>

      <p>
        ${paid}
      </p>

    </div>


    <div class="card">

      <h3>
        Delivered
      </h3>

      <p>
        ${delivered}
      </p>

    </div>


    <div class="card">

      <h3>
        Verified Sales
      </h3>

      <p>
        NLe ${revenue.toFixed(2)}
      </p>

    </div>

  `;

  recentOrders.innerHTML = data
    .slice(0, 10)
    .map(
      (order) => `

          <article class="card">

            <h3>
              ${order.order_number}
            </h3>

            <p>
              Total:
              NLe ${order.total}
            </p>

            <p>
              Payment:
              ${order.payment_status}
            </p>

            <p>
              Status:
              ${order.order_status}
            </p>

          </article>

        `,
    )
    .join("");
}

loadDashboard();
