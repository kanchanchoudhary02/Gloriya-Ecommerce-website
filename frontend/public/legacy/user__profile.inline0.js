const API_BASE = window.API_BASE || "https://gloriya.in/api";
const token = localStorage.getItem("auth_token");
if (!token) window.location.href = "../login.html";
const headers = () => ({ "Content-Type":"application/json", Authorization:`Bearer ${token}` });
document.addEventListener("DOMContentLoaded", async () => {
  const info=document.getElementById("profileInfo"), wrap=document.getElementById("profileFormWrap"), edit=document.getElementById("profileEditBtn"), cancel=document.getElementById("profileCancelBtn"), form=document.getElementById("profileForm"), msg=document.getElementById("profileMsg");
  async function load(){ const r=await fetch(`${API_BASE}/auth/me`,{headers:headers(),credentials:"include"}); const d=await r.json(); if(!r.ok) throw new Error(d.msg||"Unable to load profile"); const u=d.user||{}; localStorage.setItem("user",JSON.stringify(u)); info.innerHTML=`<p><strong>Name:</strong> ${u.name||"—"}</p><p><strong>Email:</strong> ${u.email||"—"}</p><p><strong>Phone:</strong> ${u.phone||"—"}</p><p><strong>Address:</strong> ${u.address||"—"}</p><p><strong>City:</strong> ${u.city||"—"}</p><p><strong>Pincode:</strong> ${u.pincode||"—"}</p>`; pName.value=u.name||""; pEmail.value=u.email||""; pPhone.value=u.phone||""; pAddress.value=u.address||""; pCity.value=u.city||""; pPincode.value=u.pincode||""; }
  try { await load(); } catch(e) { info.innerHTML=`<p class="text-danger">${e.message}</p>`; return; }
  edit.onclick=()=>wrap.classList.remove("d-none"); cancel.onclick=()=>wrap.classList.add("d-none");
  form.onsubmit=async e=>{ e.preventDefault(); msg.className="small mt-2 text-muted"; msg.textContent="Saving..."; const r=await fetch(`${API_BASE}/auth/me`,{method:"PUT",headers:headers(),credentials:"include",body:JSON.stringify({name:pName.value,phone:pPhone.value,address:pAddress.value,city:pCity.value,pincode:pPincode.value})}); const d=await r.json(); if(!r.ok){msg.className="small mt-2 text-danger";msg.textContent=d.msg||"Unable to save";return;} msg.className="small mt-2 text-success";msg.textContent="Profile updated successfully."; wrap.classList.add("d-none"); await load(); };
});
