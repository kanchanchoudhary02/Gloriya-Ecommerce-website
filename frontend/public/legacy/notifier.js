
  /* =========================================================
     Gloriya Notifier — global toasts (singleton, idempotent)
     Exposes:
       window.notify(msg, type='success', icon=null, timeout=2400)
       window.showToast(...)  // alias for backward compatibility
     Also listens for:
       window.dispatchEvent(new CustomEvent('cart:notify', { detail: '🛒 Added to Cart' }))
       window.dispatchEvent(new CustomEvent('wishlist:notify', { detail: '❤️ Added to Wishlist' }))
     ========================================================= */
  (function initGloriyaNotifier(){
    if (window.__GLORIYA_NOTIFY__) return;   // prevent double init
    window.__GLORIYA_NOTIFY__ = true;

    // Ensure container exists (works even if the <div> above is omitted)
    function ensureWrap(){
      let wrap = document.querySelector('.glr-toast-wrap');
      if (!wrap){
        wrap = document.createElement('div');
        wrap.className = 'glr-toast-wrap';
        document.body.appendChild(wrap);
      }
      return wrap;
    }

    function notify(msg, type='success', icon=null, timeout=2400){
      const wrap = ensureWrap();
      const el = document.createElement('div');
      el.className = `glr-toast ${type}`;
      el.innerHTML = `
        <span class="icon">${icon || (type==='success' ? '✅' :
                                       type==='error'   ? '⚠️' :
                                       type==='warn'    ? '⚠️' : 'ℹ️')}</span>
        <span class="msg">${String(msg || '').replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</span>
        <button class="close" aria-label="Close">✕</button>
      `;
      wrap.appendChild(el);

      // animate in
      requestAnimationFrame(()=> el.classList.add('show'));

      // remove helpers
      const remove = ()=>{ el.classList.remove('show'); setTimeout(()=> el.remove(), 180); };
      const t = setTimeout(remove, Math.max(1200, timeout|0));
      el.querySelector('.close').addEventListener('click', ()=>{ clearTimeout(t); remove(); });
    }

    // Expose globals (keep old API working)
    window.notify = notify;
    window.showToast = notify;

    // Convenience events used across the site
    window.addEventListener('cart:notify',     (e)=> notify(e.detail || 'Added to cart', 'success', '🛒'));
    window.addEventListener('wishlist:notify', (e)=> notify(e.detail || 'Added to wishlist', 'success', '❤️'));

    // Optional: quick smoke-test in console
    // setTimeout(()=>{ try{ notify('Notifier ready'); }catch(e){} }, 0);
  })();
