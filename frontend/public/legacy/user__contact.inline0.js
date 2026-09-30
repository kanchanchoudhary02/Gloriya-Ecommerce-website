
      document
        .getElementById("contactForm")
        .addEventListener("submit", function (e) {
          e.preventDefault();
          const name = document.getElementById("name").value.trim();
          const email = document.getElementById("email").value.trim();
          const message = document.getElementById("message").value.trim();

          if (!name || !email || !message) {
            alert("Please fill all fields!");
            return;
          }

          // Future: send to backend via API
          alert("Thank you, " + name + "! Your message has been sent.");
          e.target.reset();
        });
    