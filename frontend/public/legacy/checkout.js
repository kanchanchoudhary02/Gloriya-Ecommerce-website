const API_BASE = window.API_BASE || "https://gloriya.in/api";

async function placeOrder() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

  if (!cart.length) {
    alert("Your cart is empty!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/orders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, items: cart }),
    });

    const data = await res.json();

    // Handle validation / stock errors from backend
    if (!res.ok) {
      // New backend behaviour: 400 with { msg, problems }
      if (data && data.problems && Array.isArray(data.problems)) {
        let msg = "Some items in your cart are unavailable:\n\n";
        data.problems.forEach((p) => {
          const id = p.id || (p.item && p.item.id) || "Unknown item";
          const reason = p.reason;
          if (reason === "out_of_stock") {
            msg += `• Item ${id}: out of stock\n`;
          } else if (reason === "insufficient_stock") {
            msg += `• Item ${id}: only ${p.available} left, you requested ${p.requested}\n`;
          } else if (reason === "not_found") {
            msg += `• Item ${id}: no longer available\n`;
          } else if (reason === "invalid_id") {
            msg += `• One of the items has an invalid id\n`;
          } else {
            msg += `• Item ${id}: ${reason || "problem"}\n`;
          }
        });
        alert(msg);
      } else {
        alert(data.msg || "Unable to create order. Please try again.");
      }
      return;
    }

    // New backend shape: { order: <razorpay data + key_id>, local_order: <our own order> }
    const { order, local_order } = data;
    if (!order || !order.id) {
      alert("Something went wrong while creating the payment order. Please try again.");
      return;
    }

    const options = {
      key: order.key_id || "rzp_test_123", // fallback just in case
      amount: order.amount, // amount in paise from backend
      currency: "INR",
      name: "Gloriya Jewellery",
      description: "Order Payment",
      order_id: order.id,
      handler: async function (response) {
        try {
          // Razorpay sends: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
          await fetch(`${API_BASE}/orders/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          alert("Payment Successful! Thank you for shopping with Gloriya 💎");
          localStorage.removeItem("cart");
          window.location.href = "index.html";
        } catch (err) {
          console.error("Error verifying payment:", err);
          alert("Payment was captured, but we couldn't verify it automatically. Please contact support with your payment details.");
        }
      },
      prefill: { name, email },
      theme: { color: "#dba39a" },
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error("Error placing order:", err);
    alert("Something went wrong while placing your order. Please check your connection and try again.");
  }
}
