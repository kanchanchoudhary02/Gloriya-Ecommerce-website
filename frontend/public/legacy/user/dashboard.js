const API_BASE = window.API_BASE || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:5000/api" : "https://gloriya-ecommerce-website.onrender.com/api");
const user = JSON.parse(localStorage.getItem("user") || "null");
const glWishlistStyle=document.createElement("style"); glWishlistStyle.textContent=`.gl-wishlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}.gl-wishlist-card{background:#fff;border:1px solid #eee4dc;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(43,30,28,.07);transition:transform .2s,box-shadow .2s}.gl-wishlist-card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(43,30,28,.12)}.gl-wishlist-media{display:block;background:#f8f3ef;aspect-ratio:1/1;overflow:hidden}.gl-wishlist-media img{width:100%;height:100%;object-fit:cover;display:block}.gl-wishlist-body{padding:14px}.gl-wishlist-body h6{margin:0 0 5px;font-weight:600}.gl-wishlist-body .btn{border-radius:999px}@media(max-width:576px){.gl-wishlist-grid{grid-template-columns:1fr 1fr;gap:12px}}`;document.head.appendChild(glWishlistStyle);

if (!user) window.location.href = "../login.html";

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function authHeaders(extra={}){const h={...extra}; const t=localStorage.getItem("auth_token")||""; if(t) h.Authorization=`Bearer ${t}`; return h;}
function money(v){return `₹${Number(v||0).toLocaleString("en-IN")}`;}
function statusLabel(s){return ({created:"Order Received",completed:"Payment Completed",packed:"Packed",shipped:"Shipped",out_for_delivery:"Out for Delivery",delivered:"Delivered",cancelled:"Cancelled"}[s]||s||"Unknown");}

document.addEventListener("DOMContentLoaded", async()=>{
  document.getElementById("userName").textContent=user.name||"Customer";
  document.getElementById("userEmail").textContent=user.email||"";
  const side = document.querySelector(".list-group");
  if (side && !side.querySelector('[data-section="help"]')) side.insertAdjacentHTML("beforeend", '<a href="#" class="list-group-item list-group-item-action" data-section="help">💬 Help Center</a>');
  document.querySelectorAll(".list-group-item-action").forEach(link=>link.addEventListener("click",e=>{e.preventDefault();document.querySelectorAll(".list-group-item-action").forEach(x=>x.classList.remove("active"));link.classList.add("active");loadSection(link.dataset.section);}));
  loadSection("wishlist");
});

async function loadSection(section){
 const content=document.getElementById("dashboardContent"); content.innerHTML="";
 if(section==="wishlist"){
  content.innerHTML=`<h4>❤️ Your Wishlist</h4><p>Loading...</p>`;
  try{const res=await fetch(`${API_BASE}/products/`);const products=await res.json();const ids=(user.wishlist||[]).map(Number);const items=products.filter(p=>ids.includes(Number(p.id)));content.innerHTML=items.length?`<div class="gl-wishlist-grid">${items.map(p=>`<article class="gl-wishlist-card"><a href="../product.html?id=${encodeURIComponent(p.id)}" class="gl-wishlist-media"><img src="${esc(p.image||p.media?.[0]?.url||"")}" alt="${esc(p.name)}" loading="lazy"></a><div class="gl-wishlist-body"><h6>${esc(p.name)}</h6><p class="text-accent mb-0">${money(p.price)}</p><a class="btn btn-sm btn-outline-dark mt-2" href="../product.html?id=${encodeURIComponent(p.id)}">View Product</a></div></article>`).join("")}</div>`:`<p class="text-muted">Your wishlist is empty.</p>`;}catch{content.innerHTML=`<p class="text-danger">Failed to load wishlist.</p>`;}
 }
 if(section==="orders"){await loadOrders(content);}
 if(section==="help"){
  content.innerHTML=`<h4>💬 Help Center</h4><p class="text-muted">Need help with an order, payment, delivery, cancellation or return?</p><div class="row g-3"><div class="col-md-6"><div class="border rounded p-3 h-100"><h6>Order support</h6><p class="small text-muted">Keep your Order ID ready and contact our support team.</p><a class="btn btn-dark btn-sm" href="../contact.html">Contact Support</a></div></div><div class="col-md-6"><div class="border rounded p-3 h-100"><h6>Cancellation & Returns</h6><p class="small text-muted mb-0">Cancellation is available within 24 hours. Returns can be requested within 7 days after delivery, subject to approval.</p></div></div></div>`;
 }
 if(section==="profile"){content.innerHTML=`<h4>⚙ My Profile</h4><p><strong>Name:</strong> ${esc(user.name)}</p><p><strong>Email:</strong> ${esc(user.email)}</p><p><strong>Phone:</strong> ${esc(user.phone||"—")}</p><p><strong>Address:</strong> ${esc(user.address||"—")}</p>`;}
}

async function loadOrders(content){
 content.innerHTML=`<h4>🛍 Your Orders</h4><p>Loading...</p>`;
 try{
  const res=await fetch(`${API_BASE}/orders/user`,{headers:authHeaders(),credentials:"include"});
  const data=await res.json().catch(()=>null);
  if(res.status===401){content.innerHTML=`<h4>🛍 Your Orders</h4><p class="text-danger">Your session has expired. <a href="../login.html">Log in again</a> to view your orders.</p>`;return;}
  if(!res.ok) throw new Error(data?.msg||"Failed to load orders");
  if(!Array.isArray(data)) throw new Error(data?.msg||"Invalid orders response");
  const orders=data.filter(order=>order&&typeof order==="object"&&String(order.status||"").toLowerCase()!=="cancelled");
  if(!orders.length){content.innerHTML=`<h4>🛍 Your Orders</h4><p class="text-muted">You haven’t placed any orders yet.</p>`;return;}
  content.innerHTML=`<h4>🛍 Your Orders</h4>`+orders.map(order=>{
   const created=new Date(order.createdAt||order.timestamp||0); const canCancel=Number.isFinite(created.getTime())&&Date.now()-created.getTime()<=86400000&&!['cancelled','delivered'].includes(order.status);
   const canReturn=order.status==='delivered';
   const items=(order.items||[]).map(it=>`<li>${Number(it.qty||1)} × ${esc(it.name)} — ${money(it.unit_price??it.price)}</li>`).join("");
   return `<div class="border rounded p-3 mb-3"><div class="d-flex justify-content-between gap-3 flex-wrap"><div><h6 class="mb-1">Order #${order.id}</h6><div class="small text-muted">${esc(order.order_id||"")}</div><div class="small"><strong>Placed:</strong> ${esc(order.timestamp||"")}</div></div><div class="text-end"><h5>${money(order.amount)}</h5><span class="badge bg-light text-dark border">${esc(statusLabel(order.status))}</span></div></div><div class="mt-2"><strong>Items:</strong><ul>${items}</ul></div><div class="d-flex flex-wrap gap-2 mt-3">${order.receipt_url?`<button class="btn btn-sm btn-dark" type="button" onclick="openReceiptPdf('${esc(order.order_id)}')">Receipt — Print / Download</button>`:""}${canCancel?`<button class="btn btn-sm btn-outline-danger" onclick="cancelMyOrder('${esc(order.order_id)}')">Cancel Order</button>`:""}${canReturn?`<button class="btn btn-sm btn-outline-warning" onclick="returnMyOrder('${esc(order.order_id)}')">Request Return</button>`:""}</div>${order.refund_status?`<div class="small mt-2"><strong>Refund:</strong> ${esc(order.refund_status)}${order.refund_id?` · ${esc(order.refund_id)}`:""}</div>`:""}</div>`;
  }).join("");
 }catch(e){console.error(e);content.innerHTML+=`<p class="text-danger">Failed to load orders.</p>`;}
}

function showOrderActionDialog({title, intro, reasons, details=false}){
 return new Promise(resolve=>{
  const overlay=document.createElement("div"); overlay.style.cssText="position:fixed;inset:0;background:rgba(25,18,16,.48);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.innerHTML=`<div style="width:min(520px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 25px 70px rgba(0,0,0,.22)"><h5 style="margin-bottom:8px">${esc(title)}</h5><p class="text-muted small">${esc(intro)}</p><label class="form-label">Reason</label><select id="orderActionReason" class="form-select mb-3">${reasons.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select>${details?`<label class="form-label">Additional details (optional)</label><textarea id="orderActionDetails" class="form-control mb-3" rows="4" placeholder="Tell us what happened"></textarea>`:""}<div class="d-flex justify-content-end gap-2"><button type="button" id="orderActionClose" class="btn btn-light">Cancel</button><button type="button" id="orderActionSubmit" class="btn btn-dark">Submit</button></div></div>`;
  document.body.appendChild(overlay);
  const close=()=>{overlay.remove();resolve(null)}; overlay.querySelector("#orderActionClose").onclick=close;
  overlay.querySelector("#orderActionSubmit").onclick=()=>{const reason=overlay.querySelector("#orderActionReason").value;const detail=overlay.querySelector("#orderActionDetails")?.value||"";overlay.remove();resolve({reason,details:detail});};
 });
}
async function cancelMyOrder(orderId){
 const choice=await showOrderActionDialog({title:"Cancel Order",intro:"Orders can be cancelled only within 24 hours of placing them.",reasons:["Changed my mind","Ordered by mistake","Found another product","Delivery time issue","Other"]}); if(!choice)return;
 const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`,{method:"POST",headers:authHeaders({"Content-Type":"application/json"}),credentials:"include",body:JSON.stringify(choice)});
 const data=await res.json().catch(()=>({})); alert(res.ok ? (data.msg || "Order cancelled successfully. Your payment refund has been initiated and should be received within 24 hours.") : (data.msg || "Cancellation failed.")); if(res.ok) loadSection("orders");
}
async function returnMyOrder(orderId){
 const choice=await showOrderActionDialog({title:"Request a Return",intro:"Returns can be requested within 7 days after delivery and are reviewed by our team.",reasons:["Damaged item","Wrong item received","Item not as described","Quality issue","Size / fit issue","Other"],details:true}); if(!choice)return;
 const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/return`,{method:"POST",headers:authHeaders({"Content-Type":"application/json"}),credentials:"include",body:JSON.stringify(choice)});
 const data=await res.json().catch(()=>({})); alert(data.msg||"Return request submitted."); if(res.ok) loadSection("orders");
}
async function openReceiptPdf(orderId){
 try{
  const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/receipt?customer=1&format=pdf&download=1`,{headers:authHeaders(),credentials:"include"});
  if(!res.ok) throw new Error(await res.text()||"Receipt could not be generated");
  const blob=await res.blob(); const url=URL.createObjectURL(blob);
  const win=window.open(url,"_blank","noopener");
  if(!win){ const a=document.createElement("a"); a.href=url; a.download=`Gloriya-Receipt-${orderId}.pdf`; a.click(); }
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){alert(e.message||"Receipt could not be downloaded.");}
}

function logout(){fetch(`${API_BASE}/auth/logout`,{method:"POST",credentials:"include"}).catch(()=>{});localStorage.removeItem("user");localStorage.removeItem("auth_token");window.location.href="../index.html";}
