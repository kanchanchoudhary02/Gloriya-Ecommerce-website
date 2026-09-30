
    const API_BASE = window.API_BASE || "https://gloriya.in/api";
    const $ = id => document.getElementById(id);
    const showError = (el, msg) => {
      if(!el) return;
      el.textContent = msg || '';
      el.classList.toggle('visible', !!msg);
    };

    // Ensure the card is visible even if navbar is tall or injected late:
    // scroll card into view after partials-loader finishes (safe no-op if loader not used)
    function ensureCardVisible(){
      const card = document.querySelector('.login-card');
      if(card && typeof card.scrollIntoView === 'function'){
        // small offset so the navbar doesn't cover it
        const y = Math.max(0, card.getBoundingClientRect().top + window.scrollY - 80);
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    // try shortly after load (won't break anything)
    setTimeout(ensureCardVisible, 600);
    // also when the page becomes visible (in case partials-loader injected late)
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(ensureCardVisible, 300); });

    // password toggle
    (function(){
      const pw = $('password'), toggle = $('togglePw'), eye = $('eyeIcon');
      if(!pw || !toggle) return;
      toggle.addEventListener('click', () => {
        const isHidden = pw.type === 'password';
        pw.type = isHidden ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
        toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        eye.className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      });
      toggle.addEventListener('keydown', ev => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle.click(); }});
    })();

    // simple toast
    function showToast(msg, timeout = 3500){
      const wrap = $('toastWrap');
      if(!wrap) return;
      const t = document.createElement('div');
      t.className = 'toast align-items-center show';
      t.role = 'alert';
      t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close me-2 m-auto" aria-label="Close"></button></div>`;
      wrap.appendChild(t);
      t.querySelector('.btn-close').addEventListener('click', () => t.remove());
      setTimeout(() => t.remove(), timeout);
    }

    // form submit: same API call + localStorage behavior as before
    document.getElementById('loginForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      showError($('emailError'), '');
      showError($('passwordError'), '');

      const email = (($('email')||{}).value || '').trim();
      const password = ($('password')||{}).value || '';
      if($('email')) $('email').value = email;
      let hasErr = false;
      if(!email){ showError($('emailError'),'Please enter your email.'); hasErr = true; }
      else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showError($('emailError'),'Please enter a valid email.'); hasErr = true; }
      if(!password){ showError($('passwordError'),'Please enter your password.'); hasErr = true; }
      if(hasErr) return;

      const submitBtn = $('submitBtn'), btnText = $('btnText'), spinner = $('btnSpinner');
      if(submitBtn) submitBtn.disabled = true;
      if(btnText) btnText.textContent = 'Logging in...';
      if(spinner) spinner.style.display = 'inline-block';

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        console.log('Login response', data);
        if(!res.ok){
          showToast(data.msg || 'Login failed');
          if(data.field === 'email') showError($('emailError'), data.msg);
          if(data.field === 'password') showError($('passwordError'), data.msg);
          return;
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('auth_token', data.token);
        if($('remember') && $('remember').checked) localStorage.setItem('remember','1'); else localStorage.removeItem('remember');
        window.location.href = data.redirect;
      } catch(err){
        console.error(err);
        showToast('Something went wrong while logging in!');
      } finally {
        if(submitBtn) submitBtn.disabled = false;
        if(btnText) btnText.textContent = 'Login';
        if(spinner) spinner.style.display = 'none';
      }
    });
  