// ============================================================
//  script.js — CareChain main application logic
//  ES6 module; imports from firebase.js
// ============================================================

import {
  auth,
  genUID,
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
  getUserProfile,
  updateUserProfile,
  getAllPatients,
  searchPatients,
  addHospitalRecord,
  getHospitalRecords,
  verifyHospitalRecord,
  addPrescription,
  getPrescriptions,
  verifyPrescription,
  createRequest,
  updateRequestStatus,
  getAllRequests,
  listenRequests,
} from "./firebase.js";

// ─── STATE ────────────────────────────────────────────────────
const S = {
  user: null,           // Firestore profile of current user
  authTab: "login",
  navTab: null,
  hospSection: "emergency",
  requests: [],         // live-synced from Firestore
  _unsubRequests: null, // unsubscribe fn for real-time listener
};

// ─── HELPERS ─────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function closeOv(id) { document.getElementById(id).classList.remove("show"); }
function openOv(id)  { document.getElementById(id).classList.add("show"); }
function v(id) { return (document.getElementById(id)?.value || "").trim().toLowerCase(); }

function th(arr, cls) {
  return arr && arr.length
    ? arr.map((a) => `<span class="tag ${cls}">${a}</span>`).join("")
    : `<span style="color:var(--t2)">None recorded</span>`;
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.style.display = "flex";
}
function hideAuthError() {
  document.getElementById("auth-error").style.display = "none";
}
function setAuthLoading(on) {
  document.getElementById("auth-loading").style.display = on ? "block" : "none";
  document.getElementById("auth-cta").disabled = on;
}

function toggleOpExtra(val) {
  document.getElementById("op-extra").style.display =
    val.toLowerCase() !== "none" && val.trim() ? "block" : "none";
}

// ─── SCREEN ROUTING ──────────────────────────────────────────
function goLand() {
  // Stop request listener when leaving dashboard
  if (S._unsubRequests) { S._unsubRequests(); S._unsubRequests = null; }
  S.user = null;
  S.navTab = null;
  show("s-land");
}

function goAuth() {
  show("s-auth");
  setAuthTab("login");
}

// ─── AUTH TAB SWITCHING ───────────────────────────────────────
function setAuthTab(t) {
  S.authTab = t;
  ["login", "signup"].forEach((x) =>
    document.getElementById("t-" + x).classList.toggle("on", x === t)
  );
  document.getElementById("login-fields").style.display  = t === "login"  ? "block" : "none";
  document.getElementById("signup-fields").style.display = t === "signup" ? "block" : "none";
  document.getElementById("auth-h").textContent =
    t === "login" ? "Welcome back" : "Create your account";
  document.getElementById("auth-sub").textContent =
    t === "login"
      ? "Enter your email — role is auto-detected from your registered account."
      : "Register below. Your CareChain ID is generated automatically.";
  document.getElementById("auth-cta").textContent =
    t === "login" ? "Sign in →" : "Create account →";

  if (t === "signup") {
    document.getElementById("uid-val").textContent = genUID();
    document.getElementById("uid-preview").style.display = "block";
  }
  hideAuthError();
}

// ─── FIREBASE AUTH: SIGN UP ───────────────────────────────────
async function doSignUp() {
  const email    = document.getElementById("s-email").value.trim();
  const password = document.getElementById("s-pass").value;
  const name     = document.getElementById("s-name").value.trim();
  const role     = document.getElementById("s-role").value;

  if (!email || !password || !name) {
    showAuthError("Please fill in Name, Email and Password.");
    return;
  }
  if (password.length < 8) {
    showAuthError("Password must be at least 8 characters.");
    return;
  }

  setAuthLoading(true);
  hideAuthError();

  try {
    const careChainId = document.getElementById("uid-val").textContent;
    const profile = await registerUser(email, password, {
      name,
      role,
      uid: careChainId,
      father:   document.getElementById("s-father").value.trim(),
      mother:   document.getElementById("s-mother").value.trim(),
      dob:      document.getElementById("s-dob").value.trim(),
      location: document.getElementById("s-location").value.trim(),
      aadhar:   document.getElementById("s-aadhar").value.trim(),
      contact:  document.getElementById("s-phone").value.trim(),
    });
    S.user = profile;
    await enterDashboard();
  } catch (err) {
    showAuthError(firebaseErrorMsg(err));
  } finally {
    setAuthLoading(false);
  }
}

// ─── FIREBASE AUTH: SIGN IN ───────────────────────────────────
async function doSignIn() {
  const email    = document.getElementById("l-id").value.trim();
  const password = document.getElementById("l-pass").value;

  if (!email || !password) {
    showAuthError("Please enter your email and password.");
    return;
  }

  setAuthLoading(true);
  hideAuthError();

  try {
    const { profile } = await loginUser(email, password);
    S.user = profile;
    await enterDashboard();
  } catch (err) {
    showAuthError(firebaseErrorMsg(err));
  } finally {
    setAuthLoading(false);
  }
}

// ─── SIGN OUT ─────────────────────────────────────────────────
async function doSignOut() {
  try { await logoutUser(); } catch (_) {}
  goLand();
}

// ─── UNIFIED AUTH HANDLER ─────────────────────────────────────
async function doAuth() {
  if (S.authTab === "login") await doSignIn();
  else await doSignUp();
}

// ─── ENTER DASHBOARD ─────────────────────────────────────────
async function enterDashboard() {
  show("s-dash");
  document.getElementById("dash-loading").style.display = "flex";
  buildSidebar();

  // Start real-time listener for requests
  if (S._unsubRequests) S._unsubRequests();
  S._unsubRequests = listenRequests((reqs) => {
    S.requests = reqs;
    buildNav(); // rebuild nav badge counts on every update
  });
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function buildSidebar() {
  const u = S.user;
  const avcl = { patient: "avt-p", hospital: "avt-h", police: "avt-po" }[u.role] || "avt-p";
  const avst = {
    patient: "background:var(--teal-d);color:var(--teal)",
    hospital: "background:var(--blue-d);color:var(--blue)",
    police: "background:var(--amber-d);color:var(--amber)",
  }[u.role];

  const avt = document.getElementById("sb-avt");
  avt.className = `avt ${avcl}`;
  avt.style.cssText = avst;
  avt.textContent = (u.name || "?")[0].toUpperCase();

  document.getElementById("sb-name").textContent = u.name || "User";
  document.getElementById("sb-uid").textContent  = u.uid  || "";

  const rp = document.getElementById("sb-rp");
  rp.className = `rp ${{ patient: "rp-p", hospital: "rp-h", police: "rp-po" }[u.role]}`;
  rp.textContent = u.role;
}

// ─── NAVIGATION ──────────────────────────────────────────────
const NAVS = {
  patient: [
    { id: "overview",      label: "Emergency Overview", dot: "dp" },
    { id: "fullprofile",   label: "Full Profile",        dot: "dp" },
    { id: "visits",        label: "Hospital Visits",     dot: "dp" },
    { id: "prescriptions", label: "Prescriptions",       dot: "dp" },
    { id: "approvals",     label: "My Approvals",        dot: "dp" },
  ],
  hospital: [
    { id: "lookup",   label: "Patient Lookup", dot: "dh" },
    { id: "requests", label: "My Requests",    dot: "dh" },
  ],
  police: [
    { id: "search",  label: "Search Patient",     dot: "dpo" },
    { id: "pending", label: "Pending Requests",   dot: "dpo", badge: true },
    { id: "history", label: "Request History",    dot: "dpo" },
  ],
};

function hospHasAnyApproval() {
  return S.requests.some(
    (r) =>
      (r.hospitalId === S.user?.firebaseUid || r.hospitalName === S.user?.name) &&
      (r.status === "approved" || r.status === "patient_approved")
  );
}

function buildNav() {
  const role  = S.user.role;
  const items = NAVS[role] || [];
  const nc    = { patient: "np", hospital: "nh", police: "npo" }[role];
  if (!S.navTab) S.navTab = items[0]?.id;

  const pc = S.requests.filter((r) => r.status === "pending").length;

  let html = `<span class="snav-sec">${role}</span>`;
  items.forEach((it) => {
    const bdg     = it.badge && pc ? `<span class="bcnt">${pc}</span>` : "";
    html += `<button class="ni ${it.id === S.navTab ? `on ${nc}` : ""}" data-nav="${it.id}">
      <span class="ndot ${it.dot}"></span>${it.label}${bdg}
    </button>`;
  });

  document.getElementById("snav").innerHTML = html;

  // Attach nav click listeners
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => setNav(btn.dataset.nav));
  });

  renderMain();
}

function setNav(t) { S.navTab = t; buildNav(); }

// ─── MAIN CONTENT ROUTER ─────────────────────────────────────
function renderMain() {
  const mc     = document.getElementById("main");
  const { role } = S.user;
  const t      = S.navTab;

  // Hide initial loading overlay
  const dl = document.getElementById("dash-loading");
  if (dl) dl.style.display = "none";

  mc.innerHTML = "";

  if (role === "patient") {
    if (t === "overview")      mc.innerHTML = rPtOv();
    else if (t === "fullprofile")   renderPtFull(mc);
    else if (t === "visits")        renderPtVisits(mc);
    else if (t === "prescriptions") renderPtRx(mc);
    else if (t === "approvals")     mc.innerHTML = rPtAppr();
  } else if (role === "hospital") {
    if (t === "lookup")   mc.innerHTML = rHospLookup();
    else if (t === "requests") mc.innerHTML = rHospReqs();
  } else if (role === "police") {
    if (t === "search")   mc.innerHTML = rPolSearch();
    else if (t === "pending") mc.innerHTML = rPolPend();
    else if (t === "history") mc.innerHTML = rPolHist();
  }
}

// ─── PATIENT: OVERVIEW ───────────────────────────────────────
function rPtOv() {
  const u = S.user;
  return `<div class="mhdr fade-in"><h2>Emergency Overview</h2><p>Critical info visible to police and hospitals during emergencies</p></div>
  <div class="uid-hdr"><div><div class="lbl">CareChain ID</div><div class="val">${u.uid || "CC-XXXX-XX"}</div></div><span class="tag t-teal">Active</span></div>
  <div class="card fade-in"><div class="ctitle">Critical — visible to responders</div>
    <div class="igrid">
      <div class="ii"><label>Blood Type</label><span style="color:var(--red);font-size:22px;font-weight:700;font-family:'Space Mono',monospace">${u.blood || "—"}</span></div>
      <div class="ii"><label>Date of Birth</label><span>${u.dob || "—"}</span></div>
      <div class="ii"><label>Allergies</label><div class="tags-row">${th(u.allergies || [], "t-red")}</div></div>
      <div class="ii"><label>Active Conditions</label><div class="tags-row">${th(u.conditions || [], "t-amber")}</div></div>
    </div>
    <div class="divider"></div>
    <div class="ii"><label>Current Medications</label><div class="tags-row" style="margin-top:4px">${th(u.medications || [], "t-blue")}</div></div>
    <div class="divider"></div>
    <div class="ii"><label>Emergency Contact</label><span>${u.emergency_contact || "—"}</span></div>
  </div>
  <div class="btn-row"><button class="btn btn-teal" onclick="setNav('fullprofile')">Edit profile</button></div>`;
}

// ─── PATIENT: FULL PROFILE ───────────────────────────────────
function renderPtFull(mc) {
  const u = S.user;
  const bgs = ["A+","A-","B+","B-","AB+","AB-","O+","O-","A1+","A1-","A2+","A2-","A1B+","A1B-","A2B+","A2B-","Bombay (hh)","Other (rare)"];
  const bgOpts = bgs.map((g) => `<option value="${g}" ${u.blood === g ? "selected" : ""}>${g}</option>`).join("");

  const ecRaw   = u.emergency_contact || "";
  const ecMatch = ecRaw.match(/^(.*?)\s*—\s*(\+\d+)\s*(.*)$/);
  const ecName  = ecMatch ? ecMatch[1] : "";
  const ecCC    = ecMatch ? ecMatch[2] : "+91";
  const ecNum   = ecMatch ? ecMatch[3] : "";

  mc.innerHTML = `<div class="mhdr fade-in"><h2>Full Profile</h2><p>Complete personal and medical details</p></div>
  <div class="card fade-in"><div class="ctitle">Personal</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="mfg"><label class="mfl">Full name</label><input class="mfi" id="pf-name" value="${u.name || ""}"/></div>
    <div class="mfg"><label class="mfl">Date of birth (DD/MM/YYYY)</label>
      <input class="mfi" id="pf-dob" value="${u.dob || ""}" placeholder="DD/MM/YYYY" maxlength="10"
        oninput="let val=this.value.replace(/\\D/g,'');if(val.length>4)val=val.slice(0,2)+'/'+val.slice(2,4)+'/'+val.slice(4,8);else if(val.length>2)val=val.slice(0,2)+'/'+val.slice(2);this.value=val;"/></div>
    <div class="mfg"><label class="mfl">Father's name</label><input class="mfi" id="pf-father" value="${u.father || ""}"/></div>
    <div class="mfg"><label class="mfl">Mother's name</label><input class="mfi" id="pf-mother" value="${u.mother || ""}"/></div>
    <div class="mfg"><label class="mfl">Location / City</label><input class="mfi" id="pf-location" value="${u.location || ""}"/></div>
    <div class="mfg"><label class="mfl">Mobile (10 digits)</label>
      <div style="display:flex;gap:6px">
        <div style="background:var(--bg);border:1px solid var(--b2);border-radius:10px;padding:0 10px;display:flex;align-items:center;font-size:13px;color:var(--t2);flex-shrink:0">+91</div>
        <input class="mfi" id="pf-contact" style="flex:1" value="${(u.contact || "").replace(/^\+91\s?/, "")}" maxlength="10" placeholder="10-digit mobile number" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)"/>
      </div>
    </div>
    <div class="mfg"><label class="mfl">Address</label><input class="mfi" id="pf-address" value="${u.address || ""}"/></div>
    <div class="mfg"><label class="mfl">Insurance</label><input class="mfi" id="pf-insurance" value="${u.insurance || ""}"/></div>
  </div>
  <div class="divider"></div><div class="ctitle">Medical</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="mfg"><label class="mfl">Blood group</label>
      <select class="mfi" id="pf-blood"><option value="">Select blood group</option>${bgOpts}</select></div>
    <div></div>
    <div class="mfg"><label class="mfl">Allergies (comma-separated)</label>
      <input class="mfi" id="pf-allergies" value="${(u.allergies || []).join(", ")}"/></div>
    <div class="mfg"><label class="mfl">Conditions</label>
      <input class="mfi" id="pf-conditions" value="${(u.conditions || []).join(", ")}"/></div>
    <div class="mfg" style="grid-column:1/-1"><label class="mfl">Current medications</label>
      <input class="mfi" id="pf-medications" value="${(u.medications || []).join(", ")}"/></div>
  </div>
  <div class="divider"></div><div class="ctitle">Emergency Contact</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="mfg"><label class="mfl">Contact person name</label>
      <input class="mfi" id="pf-ecname" value="${ecName}" placeholder="e.g. Ramesh Sharma"/></div>
    <div class="mfg"><label class="mfl">Phone number</label>
      <div style="display:flex;gap:6px">
        <select class="mfi" id="pf-eccc" style="flex-shrink:0;width:110px">
          <option value="+91" ${ecCC==="+91"?"selected":""}>🇮🇳 +91</option>
          <option value="+1"  ${ecCC==="+1" ?"selected":""}>🇺🇸 +1</option>
          <option value="+44" ${ecCC==="+44"?"selected":""}>🇬🇧 +44</option>
          <option value="+971"${ecCC==="+971"?"selected":""}>🇦🇪 +971</option>
          <option value="+65" ${ecCC==="+65"?"selected":""}>🇸🇬 +65</option>
          <option value="+61" ${ecCC==="+61"?"selected":""}>🇦🇺 +61</option>
        </select>
        <input class="mfi" id="pf-ecnum" style="flex:1" value="${ecNum}" placeholder="Phone number"/>
      </div>
    </div>
  </div>
  <div id="pf-msg" style="display:none;margin-bottom:8px;font-size:13px" class="notice"></div>
  <button id="pf-savebtn" class="btn btn-teal" style="margin-top:8px">Save changes</button>
  </div>`;

  // Attach dirty-state listener
  const fields = ["pf-name","pf-dob","pf-father","pf-mother","pf-location","pf-contact",
    "pf-address","pf-insurance","pf-blood","pf-allergies","pf-conditions","pf-medications",
    "pf-ecname","pf-eccc","pf-ecnum"];
  fields.forEach((fid) => {
    const el = document.getElementById(fid);
    if (!el) return;
    el.addEventListener("input",   markDirty);
    el.addEventListener("change",  markDirty);
  });
  document.getElementById("pf-savebtn").addEventListener("click", savePtFull);
}

function markDirty() {
  const btn = document.getElementById("pf-savebtn");
  if (btn && btn.textContent !== "✓ Saved") {
    btn.className = "btn btn-red";
    btn.textContent = "Save";
  }
}

async function savePtFull() {
  const u   = S.user;
  const btn = document.getElementById("pf-savebtn");
  const msg = document.getElementById("pf-msg");

  btn.disabled = true;
  btn.textContent = "Saving…";

  const mob    = document.getElementById("pf-contact").value;
  const ecName = document.getElementById("pf-ecname").value;
  const ecCC   = document.getElementById("pf-eccc").value;
  const ecNum  = document.getElementById("pf-ecnum").value;

  const updates = {
    name:              document.getElementById("pf-name").value || u.name,
    dob:               document.getElementById("pf-dob").value,
    father:            document.getElementById("pf-father").value,
    mother:            document.getElementById("pf-mother").value,
    location:          document.getElementById("pf-location").value,
    address:           document.getElementById("pf-address").value,
    insurance:         document.getElementById("pf-insurance").value,
    blood:             document.getElementById("pf-blood").value,
    allergies:         document.getElementById("pf-allergies").value.split(",").map((s) => s.trim()).filter(Boolean),
    conditions:        document.getElementById("pf-conditions").value.split(",").map((s) => s.trim()).filter(Boolean),
    medications:       document.getElementById("pf-medications").value.split(",").map((s) => s.trim()).filter(Boolean),
    contact:           mob ? "+91 " + mob : u.contact,
    emergency_contact: ecName ? `${ecName} — ${ecCC} ${ecNum}` : `${ecCC} ${ecNum}`,
  };

  try {
    await updateUserProfile(u.firebaseUid, updates);
    Object.assign(S.user, updates);
    document.getElementById("sb-name").textContent = S.user.name;
    btn.className   = "btn btn-teal";
    btn.textContent = "✓ Saved";
    msg.style.display = "none";
  } catch (err) {
    msg.className   = "notice n-red";
    msg.textContent = "Save failed: " + err.message;
    msg.style.display = "flex";
    btn.className   = "btn btn-red";
    btn.textContent = "Retry";
  } finally {
    btn.disabled = false;
  }
}

// ─── PATIENT: VISITS ─────────────────────────────────────────
async function renderPtVisits(mc) {
  mc.innerHTML = loadingHtml("Loading hospital visits…");
  try {
    const recs = await getHospitalRecords(S.user.uid);
    if (!recs.length) {
      mc.innerHTML = `<div class="mhdr fade-in"><h2>Hospital Visits</h2><p>Medical history added by hospitals</p></div>
        <div class="card"><div class="empty">No hospital visit records yet.</div></div>`;
      return;
    }
    const hasUnverified = recs.some((r) => !r.patientVerifyStatus || r.patientVerifyStatus === "pending");
    mc.innerHTML = `<div class="mhdr fade-in"><h2>Hospital Visits</h2><p>Review records added by hospitals — verify accurate ones, deny incorrect ones</p></div>
      ${hasUnverified ? '<div class="notice n-amber">⚠️ Some records are awaiting your verification. Please review and confirm they are accurate.</div>' : ""}
      ${recs.map((r) => {
        const vs = r.patientVerifyStatus || "pending";
        let vBadge = "";
        if (vs === "approved") vBadge = '<span class="tag t-green">✓ You verified this record</span>';
        else if (vs === "denied") vBadge = '<span class="tag t-red">✗ You disputed this record</span>';
        else vBadge = `<span class="tag t-amber">Pending verification</span>
          <button class="btn btn-teal" onclick="verifyRecordById('${r.id}')">✓ Verify</button>
          <button class="btn btn-red"  onclick="denyRecordById('${r.id}')">✗ Dispute</button>`;
        return `${vcHtml(r)}<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;margin-bottom:16px">${vBadge}</div>`;
      }).join("")}`;
  } catch (err) {
    mc.innerHTML = errorHtml("Failed to load visits: " + err.message);
  }
}

window.verifyRecordById = async (id) => {
  try {
    await verifyHospitalRecord(id, "approved");
    renderMain();
  } catch (e) { alert("Error: " + e.message); }
};
window.denyRecordById = async (id) => {
  try {
    await verifyHospitalRecord(id, "denied");
    renderMain();
  } catch (e) { alert("Error: " + e.message); }
};

// ─── PATIENT: PRESCRIPTIONS ──────────────────────────────────
async function renderPtRx(mc) {
  mc.innerHTML = loadingHtml("Loading prescriptions…");
  try {
    const rxs = await getPrescriptions(S.user.uid);
    if (!rxs.length) {
      mc.innerHTML = `<div class="mhdr fade-in"><h2>Prescriptions</h2><p>Medications prescribed by your doctors</p></div>
        <div class="card"><div class="empty">No prescriptions recorded yet.</div></div>`;
      return;
    }
    mc.innerHTML = `<div class="mhdr fade-in"><h2>Prescriptions</h2><p>Review and verify prescriptions added by hospitals</p></div>
      ${rxs.map((r) => {
        const vs = r.patientVerifyStatus || "pending";
        let vBadge = "";
        if (vs === "approved") vBadge = '<span class="tag t-green">✓ Verified</span>';
        else if (vs === "denied") vBadge = '<span class="tag t-red">✗ Disputed</span>';
        else vBadge = `<button class="btn btn-teal" onclick="verifyRxById('${r.id}')">✓ Verify</button>
          <button class="btn btn-red" onclick="denyRxById('${r.id}')">✗ Dispute</button>`;
        return rxHtml(r) + `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;margin-bottom:16px"><span class="tag t-amber" style="${vs !== 'pending' ? 'display:none' : ''}">Awaiting verification</span>${vBadge}</div>`;
      }).join("")}`;
  } catch (err) {
    mc.innerHTML = errorHtml("Failed to load prescriptions: " + err.message);
  }
}

window.verifyRxById = async (id) => {
  try { await verifyPrescription(id, "approved"); renderMain(); }
  catch (e) { alert("Error: " + e.message); }
};
window.denyRxById = async (id) => {
  try { await verifyPrescription(id, "denied"); renderMain(); }
  catch (e) { alert("Error: " + e.message); }
};

// ─── PATIENT: APPROVALS ──────────────────────────────────────
function rPtAppr() {
  const reqs = S.requests.filter(
    (r) => r.type === "general" && r.patientMedId === S.user.uid
  );
  if (!reqs.length)
    return `<div class="mhdr fade-in"><h2>My Approvals</h2><p>Hospital general checkup access requests</p></div>
      <div class="card"><div class="empty">No pending approval requests from hospitals.</div></div>`;

  const rows = reqs.map((r) => {
    let actions = "", statusText = "";
    if (r.status === "patient_pending") {
      actions = `<button class="btn btn-teal" onclick="ptApp('${r.id}')">✓ Approve</button>
        <button class="btn btn-red" onclick="ptRej('${r.id}')">✗ Deny</button>`;
      statusText = "Requesting access to your complete medical records";
    } else if (r.status === "patient_approved") {
      actions = `<span class="tag t-green">Active session</span>
        <button class="btn btn-red" style="margin-left:6px" onclick="ptCloseRec('${r.id}')">End Session</button>`;
      statusText = "Hospital currently has access to your records";
    } else if (r.status === "hospital_closed") {
      actions = `<span class="tag t-amber">Hospital closed this session</span>`;
      statusText = "Hospital ended the session — access revoked.";
    } else if (r.status === "patient_closed") {
      actions = `<span class="tag t-gray">You ended this session</span>`;
      statusText = "You closed this session.";
    } else if (r.status === "rejected") {
      actions = `<span class="tag t-red">Denied</span>`;
      statusText = "You denied this request";
    } else {
      actions = `<span class="tag t-gray">${r.status}</span>`;
    }
    return `<div class="rrow"><div class="rrow-info"><h4>${r.hospitalName} — General Checkup</h4>
      <p>${r.time}${statusText ? " · " + statusText : ""}</p>
    </div><div class="act-row">${actions}</div></div>`;
  }).join("");
  return `<div class="mhdr fade-in"><h2>My Approvals</h2><p>Approve, deny, or end hospital general checkup sessions</p></div>${rows}`;
}

window.ptApp = async (id) => {
  try { await updateRequestStatus(id, { status: "patient_approved" }); }
  catch (e) { alert("Error: " + e.message); }
};
window.ptRej = async (id) => {
  try { await updateRequestStatus(id, { status: "rejected" }); }
  catch (e) { alert("Error: " + e.message); }
};
window.ptCloseRec = async (id) => {
  try { await updateRequestStatus(id, { status: "patient_closed" }); }
  catch (e) { alert("Error: " + e.message); }
};

// ─── HOSPITAL: PATIENT LOOKUP ────────────────────────────────
let _hs = null;

function rHospLookup() {
  const stabs = `<div class="stabs">
    <button class="stab ${S.hospSection === "emergency" ? "on" : ""}" onclick="setHS('emergency')">⚡ Emergency Access</button>
    <button class="stab ${S.hospSection === "general"   ? "on" : ""}" onclick="setHS('general')">📋 General Checkup</button>
  </div>`;
  const note =
    S.hospSection === "emergency"
      ? `<div class="notice n-red">⚡ Emergency — requires police verification. Full records unlock after police approval.</div>`
      : `<div class="notice n-blue">📋 General checkup — request goes to patient. Once patient approves you can view ALL records.</div>`;

  let res = "";
  if (_hs !== null) {
    res = !_hs.length
      ? '<div class="empty">No patients found.</div>'
      : _hs.map((p) => {
          const req = S.requests.find(
            (r) =>
              r.patientMedId === p.uid &&
              (r.hospitalId === S.user.firebaseUid || r.hospitalName === S.user.name) &&
              r.type === S.hospSection
          );
          const st  = req?.status;
          const btn = !req
            ? `<button class="btn btn-blue" onclick="sendHReq('${p.uid}','${escHtml(p.name)}')">Send ${S.hospSection === "emergency" ? "Emergency" : "Checkup"} Request</button>`
            : st === "pending"
            ? '<span class="tag t-amber">⏳ Awaiting police</span>'
            : st === "patient_pending"
            ? '<span class="tag t-blue">⏳ Awaiting patient</span>'
            : st === "approved" || st === "patient_approved"
            ? `<button class="btn btn-teal" onclick="viewPatientRecord('${p.uid}',true)">View Full Record</button>`
            : `<span class="tag t-gray">${st}</span>`;
          return `<div class="rrow"><div class="rrow-info">
            <h4>${p.name} <span class="tag t-blue" style="margin-left:6px;font-size:11px">${p.uid}</span></h4>
            <p>Father: ${p.father || "—"} · Mother: ${p.mother || "—"} · Location: ${p.location || "—"} · Emergency: ${p.emergency_contact || "—"}</p>
          </div><div class="act-row">${btn}</div></div>`;
        }).join("");
  }

  return `<div class="mhdr fade-in"><h2>Patient Lookup</h2><p>Search and request access to patient records</p></div>
    ${stabs}${note}
    <div class="card fade-in"><div class="search-bar">
      <input class="si" id="hs-n" placeholder="Patient name"/>
      <input class="si" id="hs-f" placeholder="Father's name"/>
      <input class="si" id="hs-m" placeholder="Mother's name"/>
      <input class="si" id="hs-l" placeholder="Location"/>
      <input class="si" id="hs-u" placeholder="CareChain ID"/>
      <button class="sbtn" onclick="doHS()">Search</button>
    </div><div id="hs-res">${res}</div></div>`;
}

window.setHS = (s) => { S.hospSection = s; _hs = null; renderMain(); };

window.doHS = async () => {
  const resEl = document.getElementById("hs-res");
  resEl.innerHTML = '<div class="empty"><div class="spinner" style="margin:auto"></div></div>';
  try {
    _hs = await searchPatients({
      name:     document.getElementById("hs-n").value.trim(),
      father:   document.getElementById("hs-f").value.trim(),
      mother:   document.getElementById("hs-m").value.trim(),
      location: document.getElementById("hs-l").value.trim(),
      uid:      document.getElementById("hs-u").value.trim(),
    });
    renderMain();
  } catch (e) {
    resEl.innerHTML = errorHtml("Search failed: " + e.message);
  }
};

window.sendHReq = async (uid, patientName) => {
  try {
    await createRequest({
      type:         S.hospSection,
      hospitalName: S.user.name,
      hospitalId:   S.user.firebaseUid,
      patientMedId: uid,
      patientName,
    });
    alert(
      `Request sent.\n${S.hospSection === "general" ? "Patient must approve from their account." : "Awaiting police verification."}`
    );
    renderMain();
  } catch (e) {
    alert("Error sending request: " + e.message);
  }
};

// ─── HOSPITAL: MY REQUESTS ────────────────────────────────────
function rHospReqs() {
  const mine   = S.requests.filter((r) => r.hospitalId === S.user.firebaseUid || r.hospitalName === S.user.name);
  const pend   = mine.filter((r) => r.status === "pending" || r.status === "patient_pending").length;
  const app    = mine.filter((r) => r.status === "approved" || r.status === "patient_approved").length;
  const closed = mine.filter((r) => ["hospital_closed","patient_closed","rejected"].includes(r.status)).length;

  const rows = mine.map((r) => {
    const isApp = r.status === "approved" || r.status === "patient_approved";
    let badge = "", notif = "";
    if (r.status === "pending")         badge = '<span class="tag t-amber">Pending police</span>';
    else if (r.status === "patient_pending") badge = '<span class="tag t-blue">Pending patient approval</span>';
    else if (isApp)                     badge = '<span class="tag t-green">Active — Access Granted</span>';
    else if (r.status === "hospital_closed") badge = '<span class="tag t-gray">You closed this session</span>';
    else if (r.status === "patient_closed") {
      badge = '<span class="tag t-red">Patient ended session</span>';
      notif = `<div class="notice n-red" style="margin-top:8px;font-size:12px">⚠️ Patient ended this session. Send a new general request to re-request access.</div>`;
    } else badge = '<span class="tag t-gray">Rejected</span>';

    const vBtn   = isApp ? `<button class="btn btn-teal" onclick="viewPatientRecord('${r.patientMedId}',true)">Open Full Record</button>` : "";
    const sBtn   = isApp && r.policeApproved ? `<button class="btn btn-green" onclick="doSMSD('${r.patientMedId}')">📱 SMS</button>` : "";
    const reopen = (r.status === "hospital_closed" || r.status === "patient_closed") && r.type === "general"
      ? `<button class="btn btn-blue" onclick="sendReopenReq('${r.patientMedId}','${escHtml(r.patientName)}')">Send New Request</button>` : "";
    const closeBtn = isApp ? `<button class="btn btn-red" onclick="hospCloseReq('${r.id}')">Close Session</button>` : "";

    return `<div class="rrow" style="flex-direction:column;align-items:flex-start">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px">
        <div class="rrow-info">
          <h4>${r.patientName} <span style="font-size:11px;color:var(--t2)">(${r.patientMedId})</span>
            <span class="tag t-${r.type === "emergency" ? "red" : "blue"}" style="font-size:10px;margin-left:4px">${r.type}</span>
          </h4>
          <p>${r.time}</p>
        </div>
        <div class="act-row">${badge}${vBtn}${sBtn}${reopen}${closeBtn}</div>
      </div>${notif}
    </div>`;
  }).join("") || '<div class="empty">No requests yet.</div>';

  return `<div class="mhdr fade-in"><h2>My Requests</h2><p>Track access requests and manage active sessions</p></div>
    <div class="stats">
      <div class="scard"><div class="sl">Pending</div><div class="sv" style="color:var(--amber)">${pend}</div></div>
      <div class="scard"><div class="sl">Active</div><div class="sv" style="color:var(--teal)">${app}</div></div>
      <div class="scard"><div class="sl">Closed</div><div class="sv" style="color:var(--red)">${closed}</div></div>
    </div>
    <div class="fade-in">${rows}</div>`;
}

window.hospCloseReq = async (id) => {
  try { await updateRequestStatus(id, { status: "hospital_closed" }); }
  catch (e) { alert("Error: " + e.message); }
};
window.sendReopenReq = async (uid, name) => {
  try {
    await createRequest({
      type: "general", hospitalName: S.user.name,
      hospitalId: S.user.firebaseUid, patientMedId: uid, patientName: name,
    });
  } catch (e) { alert("Error: " + e.message); }
};

// ─── POLICE: SEARCH ───────────────────────────────────────────
let _ps = null;

function rPolSearch() {
  let res = "";
  if (_ps !== null) {
    res = !_ps.length
      ? '<div class="empty">No patients found.</div>'
      : _ps.map((p) => `
        <div class="rrow"><div class="rrow-info">
          <h4>${p.name} <span class="tag t-amber" style="margin-left:6px;font-size:11px">${p.uid}</span></h4>
          <p>Father: ${p.father || "—"} · Mother: ${p.mother || "—"} · Location: ${p.location || "—"} · Blood: ${p.blood || "—"} · Contact: ${p.contact || "—"}</p>
        </div>
        <div class="act-row">
          <button class="btn btn-amber" onclick="viewPatientRecord('${p.uid}',false)">Full Record</button>
          <button class="btn btn-green" onclick="doSMSD('${p.uid}')">📱 SMS Contact</button>
        </div></div>`).join("");
  }
  return `<div class="mhdr fade-in"><h2>Patient Search</h2><p>Search for emergency identification</p></div>
    <div class="card fade-in"><div class="search-bar">
      <input class="si" id="ps-n" placeholder="Patient name"/>
      <input class="si" id="ps-f" placeholder="Father's name"/>
      <input class="si" id="ps-m" placeholder="Mother's name"/>
      <input class="si" id="ps-l" placeholder="Location"/>
      <input class="si" id="ps-u" placeholder="CareChain ID"/>
      <button class="sbtn" onclick="doPS()">Search</button>
    </div><div id="ps-res">${res}</div></div>`;
}

window.doPS = async () => {
  const resEl = document.getElementById("ps-res");
  resEl.innerHTML = '<div class="empty"><div class="spinner" style="margin:auto"></div></div>';
  try {
    _ps = await searchPatients({
      name:     document.getElementById("ps-n").value.trim(),
      father:   document.getElementById("ps-f").value.trim(),
      mother:   document.getElementById("ps-m").value.trim(),
      location: document.getElementById("ps-l").value.trim(),
      uid:      document.getElementById("ps-u").value.trim(),
    });
    renderMain();
  } catch (e) {
    resEl.innerHTML = errorHtml("Search failed: " + e.message);
  }
};

// ─── POLICE: PENDING REQUESTS ─────────────────────────────────
function rPolPend() {
  const pend = S.requests.filter((r) => r.status === "pending");
  const app  = S.requests.filter((r) => r.status === "approved").length;
  const rej  = S.requests.filter((r) => r.status === "rejected").length;

  const rows = pend.map((r) => `
    <div class="rrow fade-in"><div class="rrow-info">
      <h4><span style="color:var(--blue)">${r.hospitalName}</span> → <span style="color:var(--amber)">${r.patientName}</span></h4>
      <p>${r.patientMedId} · ${r.time}</p>
    </div>
    <div class="act-row">
      <button class="btn btn-teal" onclick="polApp('${r.id}')">✓ Approve</button>
      <button class="btn btn-red"  onclick="polRej('${r.id}')">✗ Reject</button>
    </div></div>`).join("") || '<div class="card"><div class="empty">No pending emergency requests.</div></div>';

  return `<div class="mhdr fade-in"><h2>Pending Requests</h2><p>Emergency hospital access requests awaiting verification</p></div>
    <div class="stats">
      <div class="scard"><div class="sl">Needs action</div><div class="sv" style="color:var(--amber)">${pend.length}</div></div>
      <div class="scard"><div class="sl">Approved</div><div class="sv" style="color:var(--teal)">${app}</div></div>
      <div class="scard"><div class="sl">Rejected</div><div class="sv" style="color:var(--red)">${rej}</div></div>
    </div><div>${rows}</div>`;
}

window.polApp = async (id) => {
  try { await updateRequestStatus(id, { status: "approved", policeApproved: true }); }
  catch (e) { alert("Error: " + e.message); }
};
window.polRej = async (id) => {
  try { await updateRequestStatus(id, { status: "rejected" }); }
  catch (e) { alert("Error: " + e.message); }
};

// ─── POLICE: HISTORY ─────────────────────────────────────────
function rPolHist() {
  const done = S.requests.filter((r) => !["pending","patient_pending"].includes(r.status));
  const rows = done.map((r) => `
    <div class="rrow"><div class="rrow-info">
      <h4>${r.hospitalName} → ${r.patientName}</h4>
      <p>${r.patientMedId} · ${r.time} · <span class="tag t-${r.type === 'emergency' ? 'red' : 'blue'}" style="font-size:10px">${r.type}</span></p>
    </div>
    ${r.status === "approved" || r.status === "patient_approved"
      ? '<span class="tag t-green">Approved</span>'
      : '<span class="tag t-gray">Rejected</span>'}
    </div>`).join("") || '<div class="empty">No completed requests.</div>';

  return `<div class="mhdr fade-in"><h2>Request History</h2><p>All completed access requests</p></div><div>${rows}</div>`;
}

// ─── VIEW PATIENT RECORD (Full page in main) ──────────────────
window.viewPatientRecord = async (uid, fromHospital) => {
  const mc = document.getElementById("main");
  mc.innerHTML = loadingHtml("Loading patient record…");
  try {
    // Fetch patient profile
    const allPats = await getAllPatients();
    const p = allPats.find((x) => x.uid === uid);
    if (!p) { mc.innerHTML = errorHtml("Patient not found."); return; }

    const [allRecs, allRxs] = await Promise.all([
      getHospitalRecords(uid),
      getPrescriptions(uid),
    ]);

    const isPolice      = S.user.role === "police";
    const myName        = S.user.name;
    const myId          = S.user.firebaseUid;
    const approvedReq   = fromHospital
      ? S.requests.find(
          (r) =>
            r.patientMedId === uid &&
            (r.hospitalId === myId || r.hospitalName === myName) &&
            (r.status === "approved" || r.status === "patient_approved")
        )
      : null;
    const isGenApproved = approvedReq?.type === "general" && approvedReq?.status === "patient_approved";
    const canSMS =
      isPolice ||
      (fromHospital &&
        S.requests.some(
          (r) =>
            r.patientMedId === uid &&
            r.policeApproved &&
            (r.hospitalId === myId || r.hospitalName === myName)
        ));

    let visRecs;
    if (isPolice)       visRecs = allRecs;
    else if (isGenApproved) visRecs = allRecs;
    else if (fromHospital)  visRecs = allRecs.filter((r) => r.addedBy === myName || (r.visibleTo || []).includes(myName));
    else                visRecs = allRecs;

    const genBadge = isGenApproved
      ? '<span class="tag t-green" style="font-size:10px;margin-left:6px">All hospitals</span>'
      : '<span class="tag t-gray" style="font-size:10px;margin-left:6px">This hospital only</span>';

    const recHtml = visRecs.length
      ? visRecs.map((r) => {
          const vs  = r.patientVerifyStatus || "pending";
          const vbg = vs === "approved"
            ? '<span class="tag t-green" style="font-size:10px">✓ Patient verified</span>'
            : vs === "denied"
            ? '<span class="tag t-red" style="font-size:10px">✗ Patient disputed</span>'
            : '<span class="tag t-amber" style="font-size:10px">Awaiting patient verification</span>';
          return vcHtml(r) + `<div style="margin-top:6px;margin-bottom:16px">${vbg}</div>`;
        }).join("")
      : '<p style="color:var(--t2);font-size:13px;padding:8px 0">No visit records available.</p>';

    const prescList = allRxs.length
      ? allRxs.map((r) => {
          const vs  = r.patientVerifyStatus || "pending";
          const vbg = vs === "approved"
            ? '<span class="tag t-green" style="font-size:10px">✓ Patient verified</span>'
            : vs === "denied"
            ? '<span class="tag t-red" style="font-size:10px">✗ Patient disputed</span>'
            : '<span class="tag t-amber" style="font-size:10px">Awaiting patient verification</span>';
          return rxHtml(r) + `<div style="margin-top:4px;margin-bottom:12px">${vbg}</div>`;
        }).join("")
      : '<p style="color:var(--t2);font-size:13px;padding:8px 0">No prescriptions on record.</p>';

    const hospActions = fromHospital
      ? `<div class="btn-row" style="margin-bottom:24px">
          <button class="btn btn-blue" onclick="openAddRecordFor('${uid}')">+ Add Medical Record</button>
          <button class="btn btn-teal" onclick="openAddRxFor('${uid}')">+ Add Prescription</button>
          ${canSMS ? `<button class="btn btn-green" onclick="doSMSD('${uid}')">📱 SMS Emergency Contact</button>` : ""}
          ${approvedReq ? `<button class="btn btn-red" onclick="hospCloseReq('${approvedReq.id}')">Close Record Session</button>` : ""}
        </div>`
      : isPolice
      ? `<div class="btn-row" style="margin-bottom:24px">${canSMS ? `<button class="btn btn-green" onclick="doSMSD('${uid}')">📱 SMS Emergency Contact</button>` : ""}</div>`
      : "";

    mc.innerHTML = `
      <div class="mhdr fade-in" style="display:flex;align-items:center;gap:14px">
        <button class="btn" onclick="buildNav()" style="flex-shrink:0">← Back</button>
        <div><h2>${p.name} — Full Medical Record</h2>
          <p style="word-break:break-all">${p.uid} &nbsp;·&nbsp; ${isPolice ? "Police access" : "Hospital: " + (isGenApproved ? "All hospitals" : "This hospital only")}</p>
        </div>
      </div>
      ${hospActions}
      <div class="card fade-in">
        <div class="ctitle">Identity &amp; Contact</div>
        <div class="igrid">
          <div class="ii"><label>CareChain ID</label><span style="color:var(--teal);font-family:'Space Mono',monospace;word-break:break-all">${p.uid}</span></div>
          <div class="ii"><label>Blood Type</label><span style="color:var(--red);font-size:20px;font-weight:700;font-family:'Space Mono',monospace">${p.blood || "—"}</span></div>
          <div class="ii"><label>Father</label><span>${p.father || "—"}</span></div>
          <div class="ii"><label>Mother</label><span>${p.mother || "—"}</span></div>
          <div class="ii"><label>Date of Birth</label><span>${p.dob || "—"}</span></div>
          <div class="ii"><label>Location</label><span>${p.location || "—"}</span></div>
          <div class="ii"><label>Contact</label><span>${p.contact || "—"}</span></div>
          <div class="ii"><label>Emergency Contact</label><span>${p.emergency_contact || "—"}</span></div>
        </div>
      </div>
      <div class="card fade-in" style="margin-top:14px">
        <div class="ctitle">Allergies &amp; Conditions</div>
        <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--t2);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Allergies</label><div class="tags-row">${th(p.allergies,"t-red")}</div></div>
        <div style="margin-bottom:10px"><label style="font-size:11px;color:var(--t2);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Conditions</label><div class="tags-row">${th(p.conditions,"t-amber")}</div></div>
        <div><label style="font-size:11px;color:var(--t2);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Medications</label><div class="tags-row">${th(p.medications,"t-blue")}</div></div>
      </div>
      <div class="card fade-in" style="margin-top:14px;overflow-x:auto">
        <div class="ctitle">Hospital Visit Records ${!isPolice && fromHospital ? genBadge : ""}</div>
        ${recHtml}
      </div>
      <div class="card fade-in" style="margin-top:14px;overflow-x:auto">
        <div class="ctitle">Prescriptions</div>
        ${prescList}
      </div>`;
  } catch (err) {
    mc.innerHTML = errorHtml("Failed to load patient record: " + err.message);
  }
};

// ─── HOSPITAL RECORD MODAL ────────────────────────────────────
window.openAddRecordFor = (uid) => {
  document.getElementById("hr-mid").value = uid;
  document.getElementById("hr-error").style.display = "none";
  openOv("mhr");
};

window.openAddRxFor = (uid) => {
  document.getElementById("rx-mid").value = uid;
  document.getElementById("rx-error").style.display = "none";
  openOv("mrx");
};

async function saveHR() {
  const mid    = document.getElementById("hr-mid").value.trim().toUpperCase();
  const errEl  = document.getElementById("hr-error");
  const saveBtn = document.getElementById("hr-save");

  errEl.style.display = "none";
  saveBtn.disabled    = true;
  saveBtn.textContent = "Saving…";

  const ops   = document.getElementById("hr-ops").value;
  const hasOp = ops && ops.toLowerCase() !== "none" && ops.trim();

  try {
    await addHospitalRecord(mid, {
      date:       document.getElementById("hr-date").value,
      hospital:   S.user.name,
      addedBy:    S.user.name,
      visibleTo:  [S.user.name],
      dept:       document.getElementById("hr-dept").value,
      doctor:     document.getElementById("hr-doctor").value,
      reason:     document.getElementById("hr-reason").value,
      treatment:  document.getElementById("hr-treatment").value,
      ops:        ops || "None",
      surgeon:    hasOp ? document.getElementById("hr-surgeon").value : "",
      anaes:      hasOp ? document.getElementById("hr-anaes").value   : "",
      atype:      hasOp ? document.getElementById("hr-atype").value   : "",
      dur:        hasOp ? document.getElementById("hr-dur").value     : "",
      findings:   hasOp ? document.getElementById("hr-findings").value : "",
      postop:     hasOp ? document.getElementById("hr-postop").value  : "",
      discharge:  document.getElementById("hr-discharge").value,
    });
    closeOv("mhr");
    viewPatientRecord(mid, true);
  } catch (err) {
    errEl.textContent     = err.message;
    errEl.style.display   = "flex";
    saveBtn.disabled      = false;
    saveBtn.textContent   = "Save Record";
  }
}

async function saveRx() {
  const mid    = document.getElementById("rx-mid").value.trim().toUpperCase();
  const errEl  = document.getElementById("rx-error");
  const saveBtn = document.getElementById("rx-save");

  errEl.style.display = "none";
  saveBtn.disabled    = true;
  saveBtn.textContent = "Saving…";

  const raw  = document.getElementById("rx-meds").value.trim();
  const meds = raw.split("\n").filter((l) => l.trim()).map((line) => {
    const pts = line.split("|").map((s) => s.trim());
    return { name: pts[0]||"", dose: pts[1]||"", freq: pts[2]||"", dur: pts[3]||"", notes: pts[4]||"" };
  });

  try {
    await addPrescription(mid, {
      hospital:    S.user.name,
      doctor:      document.getElementById("rx-doc").value,
      date:        document.getElementById("rx-date").value,
      diagnosis:   document.getElementById("rx-diag").value,
      meds,
      instructions: document.getElementById("rx-inst").value,
      reviewDate:  document.getElementById("rx-review").value,
    });
    closeOv("mrx");
    viewPatientRecord(mid, true);
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = "flex";
    saveBtn.disabled    = false;
    saveBtn.textContent = "Save Prescription";
  }
}

// ─── SMS (MOCK ALERT) ─────────────────────────────────────────
window.doSMSD = async (uid) => {
  try {
    const all = await getAllPatients();
    const p   = all.find((x) => x.uid === uid);
    alert(
      `📱 SMS sent to ${p?.emergency_contact || "emergency contact"}:\n"CareChain Emergency Alert: ${p?.name || "Patient"} requires immediate assistance. Please contact the attending team urgently."`
    );
  } catch (_) {
    alert("📱 SMS alert sent to emergency contact.");
  }
};

// ─── SHARED RENDER HELPERS ────────────────────────────────────
function vcHtml(r) {
  const hasOp = r.ops && r.ops.toLowerCase() !== "none" && r.ops.trim();
  const opSection = hasOp
    ? `<div class="op-rpt">
        <div class="op-rpt-head">
          <div><div class="op-rpt-title">Operative Report</div><div class="op-rpt-sub">${r.ops}</div></div>
          <span class="tag t-purple">Surgical procedure</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="op-fld"><div class="op-fld-lbl">Surgeon</div><div class="op-fld-val">${r.surgeon||"—"}</div></div>
          <div class="op-fld"><div class="op-fld-lbl">Anaesthetist</div><div class="op-fld-val">${r.anaes||"—"}</div></div>
          <div class="op-fld"><div class="op-fld-lbl">Anaesthesia type</div><div class="op-fld-val">${r.atype||"—"}</div></div>
          <div class="op-fld"><div class="op-fld-lbl">Duration</div><div class="op-fld-val">${r.dur||"—"}</div></div>
        </div>
        ${r.findings ? `<div class="op-fld"><div class="op-fld-lbl">Operative findings</div><div class="op-fld-box">${r.findings}</div></div>` : ""}
        ${r.postop   ? `<div class="op-fld" style="margin-top:10px"><div class="op-fld-lbl">Post-operative instructions</div><div class="op-fld-box">${r.postop}</div></div>` : ""}
      </div>` : "";
  return `<div class="vc fade-in">
    <div class="vc-head">
      <div><div class="vc-title">${r.reason}</div><div class="vc-sub">${r.hospital}${r.dept ? " · " + r.dept : ""} &nbsp;·&nbsp; ${r.date}${r.doctor ? " &nbsp;·&nbsp; " + r.doctor : ""}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${hasOp ? '<span class="tag t-purple">Surgical</span>' : ""}<span class="tag t-gray">Hospital entry</span></div>
    </div>
    <div class="vc-sec"><div class="vc-sec-lbl">Treatment</div><div class="vc-sec-body">${r.treatment}</div></div>
    ${opSection}
    ${r.discharge ? `<div class="disch-box"><div class="disch-lbl">Discharge Summary</div><div class="disch-txt">${r.discharge}</div></div>` : ""}
  </div>`;
}

function rxHtml(r) {
  const rows = (r.meds || []).map(
    (m) => `<tr><td><strong>${m.name}</strong></td><td>${m.dose}</td><td>${m.freq}</td><td>${m.dur}</td><td>${m.notes}</td></tr>`
  ).join("");
  return `<div class="rx-card fade-in">
    <div class="rx-hdr"><div><div class="rx-title">${r.diagnosis}</div><div class="rx-doc">${r.hospital}</div></div><span class="tag t-blue">${r.date}</span></div>
    <table class="rx-tbl"><thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="rx-foot">
      <div class="rx-sig"><strong>${r.doctor}</strong><span>Next review: ${r.reviewDate || "As needed"}</span></div>
      ${r.instructions ? `<div style="font-size:12px;color:var(--t2);max-width:280px;text-align:right;line-height:1.5">${r.instructions}</div>` : ""}
    </div>
  </div>`;
}

function loadingHtml(msg = "Loading…") {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;gap:16px">
    <div class="spinner"></div><p style="color:var(--t2);font-size:14px">${msg}</p></div>`;
}
function errorHtml(msg) {
  return `<div class="notice n-red fade-in">${msg}</div>`;
}
function escHtml(s) { return (s || "").replace(/'/g, "\\'"); }

// ─── FIREBASE ERROR MESSAGES ──────────────────────────────────
function firebaseErrorMsg(err) {
  const map = {
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password is too weak. Use at least 8 characters.",
    "auth/too-many-requests":    "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/invalid-credential":   "Invalid email or password.",
  };
  return map[err.code] || err.message || "An unexpected error occurred.";
}

// ─── WINDOW GLOBALS (called by inline HTML event handlers) ────
window.setNav        = setNav;
window.buildNav      = buildNav;
window.renderMain    = renderMain;

// ─── EVENT LISTENERS ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Landing
  document.getElementById("land-enter-btn").addEventListener("click", goAuth);

  // Auth
  document.getElementById("back-btn").addEventListener("click", goLand);
  document.getElementById("t-login").addEventListener("click", () => setAuthTab("login"));
  document.getElementById("t-signup").addEventListener("click", () => setAuthTab("signup"));
  document.getElementById("auth-cta").addEventListener("click", doAuth);

  // Allow Enter key to submit auth form
  ["l-id","l-pass","s-email","s-pass"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") doAuth(); });
  });

  // Sign out
  document.getElementById("signout-btn").addEventListener("click", doSignOut);

  // Modal close on backdrop click
  document.querySelectorAll(".ov").forEach((o) =>
    o.addEventListener("click", (e) => { if (e.target === o) o.classList.remove("show"); })
  );

  // Modal: view record
  document.getElementById("mv-close").addEventListener("click", () => closeOv("mv"));

  // Modal: add hospital record
  document.getElementById("hr-cancel").addEventListener("click", () => closeOv("mhr"));
  document.getElementById("hr-save").addEventListener("click", saveHR);
  document.getElementById("hr-ops").addEventListener("input", (e) => toggleOpExtra(e.target.value));

  // Modal: add prescription
  document.getElementById("rx-cancel").addEventListener("click", () => closeOv("mrx"));
  document.getElementById("rx-save").addEventListener("click", saveRx);

  // Role selector on signup — show UID preview only for patient
  document.getElementById("s-role").addEventListener("change", (e) => {
    const isPatient = e.target.value === "patient";
    document.getElementById("uid-preview").style.display =
      isPatient && document.getElementById("signup-fields").style.display !== "none" ? "block" : "none";
  });

  // Restore session if Firebase already has a signed-in user
  onAuthChange(async (fbUser) => {
    if (fbUser && !S.user) {
      try {
        S.user = await getUserProfile(fbUser.uid);
        await enterDashboard();
      } catch (_) {
        // Profile doesn't exist yet — let them land on the sign-in screen
        show("s-land");
      }
    }
  });
});
