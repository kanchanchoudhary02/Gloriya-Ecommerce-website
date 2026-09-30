
    (function(){

      const host = document.getElementById("glFloat");

      if(!host) return;

      const WORDS = [
        "GLORIYA","Handcrafted","Jaipur","Kundan","CZ",
        "Bridal","Choker","Bangles","Earrings","Necklaces",
        "Pendants","Gold-plated","Gift Wrap","Free Delivery",
        "Razorpay Secure","Made in India"
      ];

      const total = 12;

      for(let i=0;i<total;i++){

        const el = document.createElement("span");

        el.textContent = WORDS[i % WORDS.length];

        const startX =
          (Math.random()*80 - 40).toFixed(0) + "vw";

        const size =
          Math.round(14 + Math.random()*18);

        const dur =
          Math.round(12 + Math.random()*8);

        const delay =
          Math.round(Math.random()*6);

        const rot =
          Math.round(-6 + Math.random()*12) + "deg";

        el.style.left =
          (8 + Math.random()*84).toFixed(0) + "vw";

        el.style.bottom =
          (-8 - Math.round(Math.random()*22)) + "vh";

        el.style.setProperty("--x", startX);
        el.style.setProperty("--r", rot);

        el.style.fontSize = size + "px";
        el.style.animationDuration = dur + "s";
        el.style.animationDelay = delay + "s";

        if(Math.random() < 0.25){

          el.style.color =
            "rgba(199,142,130,.22)";

          el.style.textShadow =
            "0 1px 8px rgba(255,255,255,.35)";
        }

        host.appendChild(el);
      }

    })();
  