
    const API_BASE = window.API_BASE || "https://gloriya.in/api";
    const $ = id => document.getElementById(id);
    const showError = (el, msg) => {
      if(!el) return;
      el.textContent = msg || '';
      el.classList.toggle('visible', !!msg);
    };

    // Ensure the card is visible if header is tall / injected late
    function ensureVisible(){
      const card = document.querySelector('.register-card');
      if(card && window.scrollTo){
        const y = Math.max(0, card.getBoundingClientRect().top + window.scrollY - 80);
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    setTimeout(ensureVisible, 600);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(ensureVisible, 300); });

    // Password toggle + strength meter
    (function(){
      const pw = $('password'), toggle = $('togglePw'), eye = $('eyeIcon'), bar = $('pwBar');
      if(pw && toggle){
        toggle.addEventListener('click', () => {
          const isHidden = pw.type === 'password';
          pw.type = isHidden ? 'text' : 'password';
          toggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
          toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
          eye.className = isHidden ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        });
        toggle.addEventListener('keydown', ev => { if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle.click(); }});
      }
      if(pw && bar){
        pw.addEventListener('input', () => {
          const v = pw.value || '';
          let score = 0;
          if (v.length >= 6) score += 1;
          if (/[A-Z]/.test(v)) score += 1;
          if (/[0-9]/.test(v)) score += 1;
          if (/[^A-Za-z0-9]/.test(v)) score += 1;
          bar.style.width = Math.min(100, (score/4)*100) + '%';
        });
      }
    })();

    // toast helper
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

    // Form submit: preserves original API and behavior (redirects to login on success)
    document.getElementById('registerForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      showError($('nameError'), '');
      showError($('emailError'), '');
      showError($('passwordError'), '');

      const name = ($('name')||{}).value?.trim() || '';
      const email = (($('email')||{}).value || '').trim();
      const password = ($('password')||{}).value || '';
      if($('email')) $('email').value = email;

      let hasErr = false;
      if(!name){ showError($('nameError'), 'Please enter your full name.'); hasErr = true; }
      if(!email){ showError($('emailError'), 'Please enter your email.'); hasErr = true; }
      else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showError($('emailError'), 'Please enter a valid email.'); hasErr = true; }
      if(!password){ showError($('passwordError'), 'Please enter a password.'); hasErr = true; }
      else if(password.length < 6){ showError($('passwordError'), 'Password must be at least 6 characters.'); hasErr = true; }
      if(hasErr) return;

      const submitBtn = $('submitBtn'), btnText = $('btnText'), spinner = $('btnSpinner');
      if(submitBtn) submitBtn.disabled = true;
      if(btnText) btnText.textContent = 'Registering...';
      if(spinner) spinner.style.display = 'inline-block';

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        console.log('Register response', data);

        if(!res.ok){
          // Show server error (field-aware if provided)
          showToast(data.msg || 'Registration failed');
          if(data.field === 'email') showError($('emailError'), data.msg);
          if(data.field === 'name') showError($('nameError'), data.msg);
          return;
        }

        // on success, behave like before: alert + redirect to login
        showToast('Account created successfully! Redirecting to login...', 2000);
        setTimeout(() => window.location.href = 'login.html', 900);
      } catch(err){
        console.error(err);
        showToast('Something went wrong during registration.');
      } finally {
        if(submitBtn) submitBtn.disabled = false;
        if(btnText) btnText.textContent = 'Register';
        if(spinner) spinner.style.display = 'none';
      }
    });
  