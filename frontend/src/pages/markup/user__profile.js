export const markup = `
<section class="container py-5" style="max-width:900px">
  <div class="card shadow border-0 p-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">⚙ My Profile</h3>
      <button id="profileEditBtn" class="btn btn-outline-dark btn-sm"><i class="fa-solid fa-pen me-1"></i>Edit</button>
    </div>
    <div id="profileInfo"></div>
    <div id="profileFormWrap" class="d-none mt-3">
      <form id="profileForm" class="row g-3">
        <div class="col-md-6"><label class="form-label">Name</label><input id="pName" class="form-control" required></div>
        <div class="col-md-6"><label class="form-label">Email</label><input id="pEmail" class="form-control" readonly></div>
        <div class="col-md-6"><label class="form-label">Phone</label><input id="pPhone" class="form-control" inputmode="tel"></div>
        <div class="col-md-6"><label class="form-label">Pincode</label><input id="pPincode" class="form-control" inputmode="numeric"></div>
        <div class="col-12"><label class="form-label">Address</label><textarea id="pAddress" class="form-control" rows="3"></textarea></div>
        <div class="col-md-6"><label class="form-label">City</label><input id="pCity" class="form-control"></div>
        <div class="col-12 d-flex gap-2"><button class="btn btn-dark" type="submit">Save Changes</button><button id="profileCancelBtn" class="btn btn-light" type="button">Cancel</button></div>
      </form>
      <div id="profileMsg" class="small mt-2"></div>
    </div>
    <div class="mt-4 pt-3 border-top"><a class="btn btn-outline-secondary" href="../contact.html"><i class="fa-solid fa-headset me-1"></i>Get Help</a></div>
  </div>
</section>`;
