import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const users = [
  // ── PATIENTS ── uid = CareChain ID so searchPatients() works
  {
    uid: "CC-4421-TN",          // CareChain ID — used for all lookups
    firebaseUid: "VY2K83StllToR5UglNlDAIMKxxO2",          // placeholder (real value set on login)
    name: "Arjun Sharma",
    email: "arjun@email.com",
    role: "patient",
    father: "Ramesh Sharma",
    mother: "Sunita Sharma",
    dob: "12/05/1990",
    blood: "B+",
    location: "Chennai, TN",
    address: "14 Anna Nagar, Chennai",
    contact: "+91 98765 43210",
    aadhar: "XXXX-4421",
    insurance: "Star Health #SH4421",
    allergies: ["Penicillin"],
    conditions: ["Type 2 Diabetes", "Hypertension"],
    medications: ["Metformin 500mg", "Amlodipine 5mg"],
    emergency_contact: "Ramesh Sharma — +91 98700 11223",
  },
  {
    uid: "CC-7832-TN",
    firebaseUid: "ifeMGpWWFBWcGdqjR9LG52jhvnW2",
    name: "Priya Menon",
    email: "priya@email.com",
    role: "patient",
    father: "Suresh Menon",
    mother: "Lakshmi Menon",
    dob: "08/11/1995",
    blood: "O+",
    location: "Coimbatore, TN",
    address: "23 RS Puram, Coimbatore",
    contact: "+91 87654 32109",
    aadhar: "XXXX-7832",
    insurance: "LIC Health #LH7832",
    allergies: ["Sulfa drugs"],
    conditions: ["Asthma", "Allergic Rhinitis"],
    medications: ["Salbutamol inhaler", "Montelukast 10mg"],
    emergency_contact: "Suresh Menon — +91 87600 44556",
  },
  {
    uid: "CC-2201-MH",
    firebaseUid: "K251lEUnnEX29iq5HsyxGEeuga12",
    name: "Rahul Desai",
    email: "rahul@email.com",
    role: "patient",
    father: "Vikram Desai",
    mother: "Asha Desai",
    dob: "23/03/1988",
    blood: "A+",
    location: "Mumbai, MH",
    address: "7 Bandra West, Mumbai",
    contact: "+91 76543 21098",
    aadhar: "XXXX-2201",
    insurance: "HDFC ERGO #HE7732",
    allergies: [],
    conditions: ["Epilepsy"],
    medications: ["Levetiracetam 500mg"],
    emergency_contact: "Vikram Desai — +91 76500 88776",
  },
  {
    uid: "CC-5510-DL",
    firebaseUid: "BdglIpfFtiVxvIpTkNmRW1FsANz2",
    name: "Kavya Iyer",
    email: "kavya@email.com",
    role: "patient",
    father: "Gopalan Iyer",
    mother: "Meena Iyer",
    dob: "17/07/1998",
    blood: "AB+",
    location: "New Delhi, DL",
    address: "33 Vasant Vihar, New Delhi",
    contact: "+91 91234 56789",
    aadhar: "XXXX-5510",
    insurance: "New India Assurance #NIA9912",
    allergies: ["Latex", "Contrast dye"],
    conditions: ["Hypothyroidism", "Migraine"],
    medications: ["Levothyroxine 50mcg", "Sumatriptan 50mg PRN"],
    emergency_contact: "Gopalan Iyer — +91 91200 33445",
  },
  {
    uid: "CC-8873-AP",
    firebaseUid: "l72G3hckO7VledkupuG8UbNWOSo2",
    name: "Mohammed Rafiq",
    email: "rafiq@email.com",
    role: "patient",
    father: "Abdul Karim",
    mother: "Fatima Begum",
    dob: "30/03/1975",
    blood: "O-",
    location: "Hyderabad, AP",
    address: "12 Banjara Hills, Hyderabad",
    contact: "+91 94455 66778",
    aadhar: "XXXX-8873",
    insurance: "Oriental Insurance #OI5521",
    allergies: ["Codeine", "Iodine"],
    conditions: ["Chronic Kidney Disease Stage 3", "Hypertension", "Anaemia"],
    medications: ["Amlodipine 10mg", "Erythropoietin inj weekly", "Ferrous sulphate"],
    emergency_contact: "Abdul Karim — +91 94400 22334",
  },

  // ── HOSPITALS ── uid = firebaseUid (hospitals log in via Firebase Auth)
  {
    uid: "h1",
    firebaseUid: "C0lBGS2Mn6X2C3SEoCGM7Teo2aE3",
    name: "Apollo Hospital Chennai",
    email: "apollo@hospital.com",
    role: "hospital",
    location: "Chennai, TN",
  },
  {
    uid: "h2",
    firebaseUid: "ZcHk8mtI95dIM944akul3x0vU5J2",
    name: "MIOT International",
    email: "miot@hospital.com",
    role: "hospital",
    location: "Chennai, TN",
  },
  {
    uid: "h3",
    firebaseUid: "84VvoToLhBXLcsxwoAe41wYgAeD2",
    name: "Kovai Medical Centre",
    email: "kovai@hospital.com",
    role: "hospital",
    location: "Coimbatore, TN",
  },
  {
    uid: "h4",
    firebaseUid: "cQbF83qry8gPQJWVM0KhmUqdBWw1",
    name: "City Diabetic Clinic",
    email: "city@clinic.com",
    role: "hospital",
    location: "Coimbatore, TN",
  },
  {
    uid: "h5",
    firebaseUid: "CzHEbWxADKNEIdTCMSVIPPPF0Zq2",
    name: "Yashoda Hospital",
    email: "yashoda@hospital.com",
    role: "hospital",
    location: "Hyderabad, AP",
  },

  // ── POLICE ── uid = firebaseUid
  {
    uid: "p1",
    firebaseUid: "3gw5ITBy9jMqESGdxqAOOtlSons1",
    name: "Avadi Police Station",
    email: "b12@tnpolice.gov.in",
    role: "police",
    location: "Avadi, Chennai, TN",
  },
  {
    uid: "p2",
    firebaseUid: "oaDa9e7YlldCor0Dw4NoKCmT9ay2",
    name: "Coimbatore Central",
    email: "c4@tnpolice.gov.in",
    role: "police",
    location: "Coimbatore, TN",
  },
  {
    uid: "p3",
    firebaseUid: "qve1epzW5WSzbQvamUlnN4FtThk1",
    name: "Banjara Hills Station",
    email: "h3@tspolice.gov.in",
    role: "police",
    location: "Banjara Hills, Hyderabad, AP",
  },
];

// ─── HOSPITAL RECORDS ─────────────────────────────────────────
// KEY RULES:
//   patientCareChainId  — matches uid in users collection
//   discharge           — (not dischargeSummary) — used by vcHtml()
//   ops                 — must be present (use "None" if no surgery)
//   patientVerifyStatus — "pending" | "approved" | "denied"
const hospitalRecords = [
  {
    patientCareChainId: "CC-4421-TN",
    patientFirebaseUid: "u1",
    hospital:   "Apollo Hospital Chennai",
    addedBy:    "Apollo Hospital Chennai",
    visibleTo:  ["Apollo Hospital Chennai"],
    doctor:     "Dr. S. Krishnamurthy, MD (General Medicine) · Reg. TN-41201",
    date:       "14 Jan 2024",
    dept:       "General Medicine",
    reason:     "Dengue fever — Day 4 of illness. Platelet count 68,000. High-grade fever 39.4°C.",
    treatment:  "IV fluids (NS 1L/day), paracetamol 500mg TDS, monitoring platelet count every 12 hrs. Dengue NS1 antigen positive. Advised rest, oral hydration, no NSAIDs.",
    ops:        "None",
    surgeon: "", anaes: "", atype: "", dur: "", findings: "", postop: "",
    discharge:  "Platelet count recovered to 1.2 lakh on Day 7. Discharged with advice to avoid aspirin/ibuprofen for 4 weeks. Follow-up CBC in 1 week.",
    patientVerified: false,
    patientVerifyStatus: "pending",
  },
  {
    patientCareChainId: "CC-7832-TN",
    patientFirebaseUid: "u2",
    hospital:   "Kovai Medical Centre",
    addedBy:    "Kovai Medical Centre",
    visibleTo:  ["Kovai Medical Centre"],
    doctor:     "Dr. R. Balasubramanian, MD (Pulmonology) · Reg. TN-52334",
    date:       "20 Feb 2024",
    dept:       "Pulmonology",
    reason:     "Acute asthma exacerbation — severe wheeze, SpO2 88% on room air, respiratory rate 28/min.",
    treatment:  "Nebulized salbutamol 2.5mg × 3 doses (20-min intervals). IV hydrocortisone 200mg stat. O2 via mask at 6L/min. SpO2 improved to 97% after 2 hrs. Peak flow improved from 45% to 72% predicted.",
    ops:        "None",
    surgeon: "", anaes: "", atype: "", dur: "", findings: "", postop: "",
    discharge:  "Stable on discharge. Maintenance inhaler (Budesonide/Formoterol) restarted. Advised to identify triggers. Spacer technique demonstrated. Follow-up pulmonology in 4 weeks.",
    patientVerified: false,
    patientVerifyStatus: "pending",
  },
  {
    patientCareChainId: "CC-8873-AP",
    patientFirebaseUid: "u5",
    hospital:   "Yashoda Hospital",
    addedBy:    "Yashoda Hospital",
    visibleTo:  ["Yashoda Hospital"],
    doctor:     "Dr. R. Srinivas, DM (Nephrology) · Reg. AP-33210",
    date:       "02 Mar 2024",
    dept:       "Nephrology",
    reason:     "CKD Stage 3b — routine review. Serum creatinine 2.4 mg/dL, eGFR 32. Haemoglobin 9.2 g/dL.",
    treatment:  "IV Iron sucrose 200mg infusion. Erythropoietin 4000 IU SC. Dietary counselling: protein restriction 0.8g/kg/day, low K+, low phosphorus, fluid restriction 1.5L/day. BP 152/94 — antihypertensive uptitrated.",
    ops:        "AV Fistula Creation (Left Arm)",
    surgeon:    "Dr. P. Mohan, MCh (Vascular Surgery)",
    anaes:      "Dr. K. Naidu, MD (Anaesthesia)",
    atype:      "Local Anaesthesia + IV Sedation (Midazolam 2mg + Fentanyl 50mcg)",
    dur:        "45 minutes",
    findings:   "Radial artery and cephalic vein of adequate calibre in left forearm. End-to-side anastomosis created. Thrill and bruit confirmed post-procedure. No haematoma.",
    postop:     "Arm elevation for 24 hrs. Avoid tight clothing/BP cuff on left arm permanently. Hand exercises from Day 2. Check thrill daily. Fistula maturation in 6–8 weeks.",
    discharge:  "AV fistula created successfully for anticipated haemodialysis. CKD Stage 3b progressing. Follow-up nephrology in 4 weeks.",
    patientVerified: false,
    patientVerifyStatus: "pending",
  },
];

// ─── PRESCRIPTIONS ────────────────────────────────────────────
// KEY RULES:
//   meds — array of { name, dose, freq, dur, notes } — NOT a string array
//   patientVerifyStatus — "pending" | "approved" | "denied"
const prescriptions = [
  {
    patientCareChainId: "CC-4421-TN",
    patientFirebaseUid: "u1",
    hospital:     "Apollo Hospital Chennai",
    doctor:       "Dr. S. Krishnamurthy, MD · Reg. TN-41201",
    date:         "18 Jan 2024",
    diagnosis:    "Dengue fever — recovery phase",
    reviewDate:   "25 Jan 2024",
    instructions: "Avoid NSAIDs (aspirin, ibuprofen) for 4 weeks. Rest adequately. Increase fluid intake. Return immediately if bleeding, severe abdominal pain, or persistent vomiting.",
    meds: [
      { name: "Tab. Paracetamol 500mg", dose: "1-2 tabs", freq: "TDS (after food)", dur: "5 days", notes: "For fever/pain. Do not exceed 4g/day." },
      { name: "ORS Sachet (Electral)", dose: "1 sachet in 250ml water", freq: "After each loose stool or as needed", dur: "As needed", notes: "Stay well hydrated. Minimum 2.5L fluids/day." },
      { name: "Tab. Vitamin C 500mg", dose: "1 tab", freq: "Once daily after food", dur: "2 weeks", notes: "Immune support during recovery." },
    ],
    patientVerified: false,
    patientVerifyStatus: "pending",
  },
  {
    patientCareChainId: "CC-5510-DL",
    patientFirebaseUid: "u4",
    hospital:     "Max Hospital Delhi",
    doctor:       "Dr. S. Banerjee, MD (Medicine) · Reg. DL-48821",
    date:         "05 Dec 2023",
    diagnosis:    "Hypothyroidism (TSH 8.4 mIU/L). Chronic Migraine.",
    reviewDate:   "05 Mar 2024",
    instructions: "Take Levothyroxine on empty stomach 30 min before food — no tea/coffee immediately after. Repeat TSH in 3 months. Maintain migraine diary (triggers: sleep, stress, hormonal). Avoid skipping meals.",
    meds: [
      { name: "Tab. Levothyroxine 50mcg (Thyronorm)", dose: "1 tab", freq: "Once daily — empty stomach, 30 min before breakfast", dur: "Ongoing", notes: "No calcium, iron or antacids within 4 hrs." },
      { name: "Tab. Sumatriptan 50mg", dose: "1 tab at onset", freq: "PRN — migraine attacks only", dur: "PRN", notes: "Max 2 tabs per attack. Do not use > 10 days/month." },
      { name: "Tab. Propranolol 20mg", dose: "1 tab", freq: "Twice daily", dur: "3 months then review", notes: "Migraine prophylaxis. Do not stop abruptly." },
      { name: "Tab. Vitamin D3 60,000 IU", dose: "1 tab", freq: "Once weekly", dur: "8 weeks", notes: "Take after food. Serum D3 was 14 ng/mL (deficient)." },
    ],
    patientVerified: false,
    patientVerifyStatus: "pending",
  },
];

// ─── REQUESTS ─────────────────────────────────────────────────
// KEY RULES:
//   hospitalId   — must match firebaseUid of the hospital user
//   patientMedId — must match uid (CareChain ID) of the patient user
//   status       — "pending" (emergency, awaiting police)
//                  "patient_pending" (general, awaiting patient)
//                  "approved" | "rejected" | "patient_approved"
//                  "hospital_closed" | "patient_closed"
const requests = [
  {
    type:         "emergency",
    hospitalName: "Apollo Hospital Chennai",
    hospitalId:   "h1",
    patientMedId: "CC-4421-TN",
    patientName:  "Arjun Sharma",
    status:       "pending",
    policeApproved: false,
    time:         "Today 2:14 PM",
  },
  {
    type:         "general",
    hospitalName: "Kovai Medical Centre",
    hospitalId:   "h3",
    patientMedId: "CC-7832-TN",
    patientName:  "Priya Menon",
    status:       "patient_pending",
    policeApproved: false,
    time:         "Today 10:30 AM",
  },
  {
    type:         "emergency",
    hospitalName: "Yashoda Hospital",
    hospitalId:   "h5",
    patientMedId: "CC-8873-AP",
    patientName:  "Mohammed Rafiq",
    status:       "approved",
    policeApproved: true,
    time:         "Yesterday 6:45 PM",
  },
];

// ─── CLEAR EXISTING COLLECTIONS (optional — avoids duplicates on re-run) ──
async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  for (const d of snap.docs) await deleteDoc(d.ref);
  console.log(`🗑️  Cleared '${name}' (${snap.size} docs)`);
}

// ─── UPLOAD ───────────────────────────────────────────────────
async function uploadAll() {
  console.log("🚀 Starting CareChain seed upload…");

  await clearCollection("users");
  await clearCollection("patients");
  await clearCollection("hospitalRecords");
  await clearCollection("prescriptions");
  await clearCollection("requests");

  // ← THIS LINE is the critical fix
  for (const u of users) {
    await setDoc(doc(db, "users", u.firebaseUid), u);  // key = real Auth UID
  }
  console.log(`✅ Users uploaded (${users.length})`);

  for (const r of hospitalRecords) {
    await addDoc(collection(db, "hospitalRecords"), r);
  }
  console.log(`✅ Hospital records uploaded (${hospitalRecords.length})`);

  for (const p of prescriptions) {
    await addDoc(collection(db, "prescriptions"), p);
  }
  console.log(`✅ Prescriptions uploaded (${prescriptions.length})`);

  for (const r of requests) {
    await addDoc(collection(db, "requests"), r);
  }
  console.log(`✅ Requests uploaded (${requests.length})`);

  console.log("🔥 ALL DATA UPLOADED SUCCESSFULLY");
}

uploadAll().catch((err) => console.error("❌ Upload failed:", err));
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Email:", user.email);
    console.log("Firebase UID:", user.uid);
  }
});
