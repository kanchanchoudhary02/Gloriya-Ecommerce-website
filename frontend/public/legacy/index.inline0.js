window.API_BASE = window.API_BASE || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://localhost:5000/api" : "https://gloriya.in/api");


/* ===== NEWSLETTER SUBSCRIPTION ===== */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("newsletterForm");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";
  const emailInput = document.getElementById("newsletterEmail");
  const button = document.getElementById("newsletterSubscribeBtn");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(emailInput?.value || "").trim();
    if (!email) return;
    const original = button?.innerHTML || "Subscribe";
    if (button) { button.disabled = true; button.innerHTML = "Subscribing..."; }
    try {
      const api = window.API_BASE || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://localhost:5000/api" : "https://gloriya.in/api");
      const res = await fetch(`${api}/contact/subscribe`, {
        method: "POST",
        headers: {"Content-Type":"application/json","Accept":"application/json"},
        body: JSON.stringify({email})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.msg || "Subscription failed");
      if (typeof window.notify === "function") window.notify(data.msg || "Subscribed successfully.", "success", "✓");
      else alert(data.msg || "Subscribed successfully.");
      form.reset();
    } catch (error) {
      console.error("newsletter subscribe error", error);
      if (typeof window.notify === "function") window.notify(error.message || "Unable to subscribe.", "error", "!");
      else alert(error.message || "Unable to subscribe.");
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  });
});
