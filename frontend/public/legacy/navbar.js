
/* ===== NOTIFIER ===== */
(function ensureNotifier(){
  const wrap = document.querySelector('.glr-toast-wrap') || (()=> {
    const w=document.createElement('div');
    w.className='glr-toast-wrap';
    document.body.appendChild(w);
    return w;
  })();

  function notify(msg,type='success',icon){
    const el=document.createElement('div');
    el.className=`glr-toast ${type}`;
    el.innerHTML=`<span>${icon||'✔️'}</span><span class="msg">${msg}</span><button class="close">✕</button>`;
    wrap.appendChild(el);

    requestAnimationFrame(()=> el.classList.add('show'));

    const remove=()=>{
      el.classList.remove('show');
      setTimeout(()=> el.remove(),200);
    };

    const t=setTimeout(remove,2400);

    el.querySelector('.close').onclick=()=>{
      clearTimeout(t);
      remove();
    };
  }

  window.notify = window.notify || notify;
})();

/* ===== NAVBAR ACCOUNT UI ===== */
function initNavbar(){
  try{
    const user = JSON.parse(localStorage.getItem('user')||'null');
    const loginContainer = document.getElementById('loginContainer');
    const userDropdown = document.getElementById('userDropdown');

    if(user){
      loginContainer.style.display='none';
      userDropdown.style.display='block';

      const firstName = (user.name||'Account').split(' ')[0];

      userDropdown.innerHTML = `
      <div class="dropdown">
        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
          <i class="fa-solid fa-user"></i> ${firstName}
        </a>

        <ul class="dropdown-menu dropdown-menu-end">
          ${
            user.role==='admin'
              ? `<li><a class="dropdown-item" href="/admin/admin.html">Admin Panel</a></li>`
              : `<li><a class="dropdown-item" href="/user/dashboard.html">My Account</a></li>`
          }

          <li>
            <a class="dropdown-item text-danger" href="#" onclick="logout()">Logout</a>
          </li>
        </ul>
      </div>`;
    } else {
      loginContainer.style.display='inline-block';
      userDropdown.style.display='none';
    }
  }catch{}

  initShopDropdown();
  initCartFab();
}

/* ===== SHOP CATEGORY DROPDOWN (Bootstrap-independent fallback) ===== */
function initShopDropdown(){
  const item = document.querySelector('.gl-shop-nav-item');
  const toggle = document.getElementById('shopDropdown');
  const menu = item?.querySelector('.gl-shop-dropdown');
  if(!item || !toggle || !menu) return;

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll('.gl-shop-nav-item .dropdown-menu.show').forEach(m => {
      if (m !== menu) m.classList.remove('show');
    });
    const open = menu.classList.toggle('show');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  menu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', (event) => {
    if (!item.contains(event.target)) {
      menu.classList.remove('show');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .navbar{position:sticky!important;top:0!important;z-index:1100!important;background:rgba(255,255,255,.97)!important;backdrop-filter:blur(14px);}
    .gl-shop-nav-item:hover>.dropdown-menu{display:none;}
    .gl-shop-nav-item>.dropdown-menu.show{display:block;}
  `;
  document.head.appendChild(style);
}


async function syncAccountCollections(){
  const token=localStorage.getItem('auth_token');
  const user=JSON.parse(localStorage.getItem('user')||'null');
  if(!token || !user?.email) return;
  const api=window.API_BASE||'https://gloriya.in/api';
  const headers={Accept:'application/json',Authorization:`Bearer ${token}`};
  try{
    const res=await fetch(`${api}/auth/me`,{headers});
    if(!res.ok)return;
    const data=await res.json(), server=data?.user||{};
    const localW=JSON.parse(localStorage.getItem('wishlist')||'[]');
    const mergedW=[...new Set([...(server.wishlist||[]).map(String),...localW.map(String)])];
    let localC=JSON.parse(localStorage.getItem('cart')||'[]');
    const normalizeCart = (items) => {
      const arr = Array.isArray(items) ? items : [];
      const byId = new Map();
      arr.forEach(item => {
        if (!item || item.id == null) return;
        let qty = Number(item.qty ?? item.quantity ?? 1);
        if (!Number.isFinite(qty) || qty < 1) qty = 1;
        // A single jewellery item should not silently become dozens/hundreds of units
        // because of an old cart migration bug.
        if (qty > 20) qty = 1;
        const key = String(item.id);
        const existing = byId.get(key);
        if (existing) existing.qty += qty;
        else byId.set(key, {...item, qty: Math.floor(qty)});
      });
      return [...byId.values()];
    };

    localC = normalizeCart(localC);
    let mergedC = normalizeCart(server.cart);
    localC.forEach(item => {
      const f=mergedC.find(x=>String(x.id)===String(item.id));
      if(f) f.qty=Math.max(Number(f.qty||1), Number(item.qty||1));
      else mergedC.push({...item,qty:Number(item.qty||1)});
    });
    const mergedTotal = mergedC.reduce((sum,item)=>sum + Number(item.qty||0),0);
    if (mergedTotal > 50) mergedC = [];
    localStorage.setItem('cart',JSON.stringify(mergedC));
    localStorage.setItem('wishlist',JSON.stringify(mergedW));
    localStorage.setItem('cart',JSON.stringify(mergedC));
    await fetch(`${api}/auth/wishlist`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({wishlist:mergedW})});
    await fetch(`${api}/auth/cart`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({cart:mergedC})});
  }catch(e){console.warn('Account collection sync skipped',e);}
}
function syncCollectionsToAccount(){
  const token=localStorage.getItem('auth_token'), user=JSON.parse(localStorage.getItem('user')||'null');
  if(!token || !user?.email)return;
  const api=window.API_BASE||'https://gloriya.in/api';
  const headers={Accept:'application/json',Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  fetch(`${api}/auth/wishlist`,{method:'PUT',headers,body:JSON.stringify({wishlist:JSON.parse(localStorage.getItem('wishlist')||'[]')})}).catch(()=>{});
  fetch(`${api}/auth/cart`,{method:'PUT',headers,body:JSON.stringify({cart:JSON.parse(localStorage.getItem('cart')||'[]')})}).catch(()=>{});
}

function logout(){
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
  window.location.href='/index.html';
}

/* ===== FAB CART BADGE ===== */
function initCartFab(){
  const badge=document.getElementById('cartFabCount');

  // Repair stale guest carts as well as logged-in carts. Older versions could
  // duplicate quantities and produce the 99+ badge.
  try{
    const raw = JSON.parse(localStorage.getItem('cart')||'[]');
    if(Array.isArray(raw)){
      const byId = new Map();
      raw.forEach(item=>{
        if(!item || item.id == null) return;
        let qty = Number(item.qty ?? item.quantity ?? 1);
        if(!Number.isFinite(qty) || qty < 1) qty = 1;
        if(qty > 20) qty = 1;
        const key=String(item.id);
        const existing=byId.get(key);
        if(existing) existing.qty += Math.floor(qty);
        else byId.set(key,{...item,qty:Math.floor(qty)});
      });
      const repaired=[...byId.values()];
      if(repaired.reduce((sum,item)=>sum+Number(item.qty||0),0)>50) repaired.length=0;
      localStorage.setItem('cart',JSON.stringify(repaired));
    }
  }catch{}

  const read=()=>{
    try{
      const cart = JSON.parse(localStorage.getItem('cart')||'[]');
      return Array.isArray(cart)
        ? cart.reduce((sum,i)=>{
            const qty = Number(i?.qty);
            return sum + (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0);
          },0)
        : 0;
    }catch{
      return 0;
    }
  };

  const render=()=>{
    const n=read();

    if(n>0){
      badge.textContent=String(n);
      badge.style.display='inline-flex';
    }else{
      badge.style.display='none';
    }
  };

  window.cartFabUpdateCount=render;

  render();

  window.addEventListener('storage', e=>{
    if(e.key==='cart') render();
  });

  window.addEventListener('cart:updated', render);
}

/* ===== Scroll-to-top FAB ===== */
(function initTopFab(){
  const top = document.getElementById('topFab');
  if(!top) return;

  const SHOW_AFTER = 200;
  let ticking = false;

  function updateVisibility(){
    const y = window.scrollY || 0;

    if(y > SHOW_AFTER){
      top.style.display = 'inline-flex';

      requestAnimationFrame(()=>{
        top.classList.add('show');
      });
    } else {
      top.classList.remove('show');

      setTimeout(()=>{
        if(!top.classList.contains('show')){
          top.style.display = 'none';
        }
      }, 180);
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if(!ticking){
      ticking = true;
      requestAnimationFrame(updateVisibility);
    }
  }, { passive: true });

  top.addEventListener('click', (e) => {
    e.preventDefault();

    top.animate(
      [
        { transform: 'translateY(-3px)' },
        { transform:'none' }
      ],
      {
        duration:150,
        easing:'ease'
      }
    );

    window.scrollTo({
      top:0,
      behavior:'smooth'
    });
  });

  requestAnimationFrame(updateVisibility);
})();

document.addEventListener('DOMContentLoaded', ()=>{
  initNavbar();
  syncAccountCollections();
  window.addEventListener('wishlist:updated',syncCollectionsToAccount);
  window.addEventListener('cart:updated',syncCollectionsToAccount);
});
