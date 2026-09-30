
      // Extend setupTabs to handle the summary tab
      // We patch after admin.js loads by overriding the click handler
      document.addEventListener("DOMContentLoaded", () => {
        // Wait for admin.js to set up its own listeners, then add ours via event delegation
        document.getElementById("adminTabs").addEventListener("click", (e) => {
          const tab = e.target.closest("[data-tab]");
          if (!tab) return;
          if (tab.dataset.tab === "summary") {
            // Mark active state
            document.querySelectorAll("#adminTabs .nav-link").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            loadOrderSummary();
          }
        }, true); // capture phase so we run before admin.js's bubble handler
      });
    