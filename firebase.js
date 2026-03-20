// ============================================================
//  firebase.js — CareChain Firebase configuration & helpers
//  Replace the firebaseConfig values with YOUR project's config
//  from: Firebase Console → Project Settings → Your Apps → SDK
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── YOUR FIREBASE CONFIG ────────────────────────────────────
// TODO: Replace these placeholder values with your actual Firebase project config.
// Get it from: https://console.firebase.google.com → Your Project →
//   Project Settings (gear icon) → General → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDXMcJmiocKxj8hCv4avyFhFbDMCvtVcJM",
  authDomain: "carechain-app.firebaseapp.com",
  projectId: "carechain-app",
  storageBucket: "carechain-app.firebasestorage.app",
  messagingSenderId: "1098241936724",
  appId: "1:1098241936724:web:bca3b0e53e5587d62c8cc1"
};
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ─── UTILITY ─────────────────────────────────────────────────
export function genUID() {
  const states = ["KA", "TN", "MH", "DL", "AP", "GJ"];
  return `CC-${Math.floor(1000 + Math.random() * 9000)}-${states[Math.floor(Math.random() * states.length)]}`;
}

// ─── AUTH ─────────────────────────────────────────────────────

/**
 * Register a new user with email/password.
 * Stores profile in Firestore "users" collection.
 * Returns the Firestore user profile object.
 */
export async function registerUser(email, password, profileData) {
  // profileData: { name, role, uid(careChainId), father, mother, dob,
  //                location, aadhar, contact, ... }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUid = cred.user.uid;

  const profile = {
    firebaseUid,
    email,
    role: profileData.role || "patient",
    name: profileData.name || "",
    uid: profileData.uid || genUID(),          // CareChain ID
    father: profileData.father || "",
    mother: profileData.mother || "",
    dob: profileData.dob || "",
    location: profileData.location || "",
    aadhar: profileData.aadhar || "",
    contact: profileData.contact || "",
    blood: profileData.blood || "",
    allergies: [],
    conditions: [],
    medications: [],
    emergency_contact: "",
    address: "",
    insurance: "",
    createdAt: serverTimestamp(),
  };

  // Store in "users" collection keyed by Firebase UID
  await setDoc(doc(db, "users", firebaseUid), profile);
  return profile;
}

/**
 * Sign in with email + password.
 * Returns { firebaseUser, profile } where profile is from Firestore.
 */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);
  return { firebaseUser: cred.user, profile };
}

/**
 * Sign out the current user.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Listen for auth state changes. cb(user) where user is Firebase user or null.
 */
export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// ─── USERS / PROFILE ─────────────────────────────────────────

/**
 * Fetch a user's Firestore profile by Firebase UID.
 */
export async function getUserProfile(firebaseUid) {
  const snap = await getDoc(doc(db, "users", firebaseUid));
  if (!snap.exists()) throw new Error("User profile not found.");
  return { id: snap.id, ...snap.data() };
}

/**
 * Update the current user's profile fields (any subset).
 */
export async function updateUserProfile(firebaseUid, updates) {
  await updateDoc(doc(db, "users", firebaseUid), updates);
}

/**
 * Fetch ALL patients (role === "patient") for hospital/police search.
 */
export async function getAllPatients() {
  const q = query(collection(db, "users"), where("role", "==", "patient"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Search patients by name, father, mother, location, or CareChain ID.
 * Does client-side filtering after fetching all patients
 * (Firestore free tier doesn't support multi-field full-text search).
 */
export async function searchPatients({ name, father, mother, location, uid }) {
  const all = await getAllPatients();
  return all.filter((p) => {
    const n = (s) => (s || "").toLowerCase();
    return (
      (!name     || n(p.name).includes(n(name))) &&
      (!father   || n(p.father).includes(n(father))) &&
      (!mother   || n(p.mother).includes(n(mother))) &&
      (!location || n(p.location).includes(n(location))) &&
      (!uid      || n(p.uid).includes(n(uid)))
    );
  });
}

// ─── HOSPITAL RECORDS ─────────────────────────────────────────

/**
 * Add a hospital visit record for a patient (identified by CareChain ID).
 */
export async function addHospitalRecord(patientCareChainId, record) {
  // Find the patient's firebaseUid from their CareChain ID
  const patientSnap = await getDocs(
    query(collection(db, "users"), where("uid", "==", patientCareChainId))
  );
  if (patientSnap.empty) throw new Error("Patient CareChain ID not found.");
  const patientFirebaseUid = patientSnap.docs[0].id;

  const docRef = await addDoc(collection(db, "hospitalRecords"), {
    ...record,
    patientCareChainId,
    patientFirebaseUid,
    patientVerified: false,
    patientVerifyStatus: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch all hospital records for a given patient CareChain ID.
 */
export async function getHospitalRecords(patientCareChainId) {
  const q = query(
    collection(db, "hospitalRecords"),
    where("patientCareChainId", "==", patientCareChainId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Update the patient verification status of a hospital record.
 */
export async function verifyHospitalRecord(recordFirestoreId, status) {
  // status: "approved" | "denied"
  await updateDoc(doc(db, "hospitalRecords", recordFirestoreId), {
    patientVerified: status === "approved",
    patientVerifyStatus: status,
  });
}

// ─── PRESCRIPTIONS ────────────────────────────────────────────

/**
 * Add a prescription for a patient identified by CareChain ID.
 */
export async function addPrescription(patientCareChainId, rxData) {
  const patientSnap = await getDocs(
    query(collection(db, "users"), where("uid", "==", patientCareChainId))
  );
  if (patientSnap.empty) throw new Error("Patient CareChain ID not found.");
  const patientFirebaseUid = patientSnap.docs[0].id;

  const docRef = await addDoc(collection(db, "prescriptions"), {
    ...rxData,
    patientCareChainId,
    patientFirebaseUid,
    patientVerified: false,
    patientVerifyStatus: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch all prescriptions for a given patient CareChain ID.
 */
export async function getPrescriptions(patientCareChainId) {
  const q = query(
    collection(db, "prescriptions"),
    where("patientCareChainId", "==", patientCareChainId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Update the patient verification status of a prescription.
 */
export async function verifyPrescription(rxFirestoreId, status) {
  await updateDoc(doc(db, "prescriptions", rxFirestoreId), {
    patientVerified: status === "approved",
    patientVerifyStatus: status,
  });
}

// ─── ACCESS REQUESTS ──────────────────────────────────────────

/**
 * Create a new access request.
 */
export async function createRequest(reqData) {
  // reqData: { type, hospitalName, hospitalId, patientMedId, patientName }
  const docRef = await addDoc(collection(db, "requests"), {
    ...reqData,
    status: reqData.type === "general" ? "patient_pending" : "pending",
    policeApproved: false,
    time: new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update the status of an access request.
 */
export async function updateRequestStatus(requestFirestoreId, updates) {
  await updateDoc(doc(db, "requests", requestFirestoreId), updates);
}

/**
 * Fetch all requests (optionally filter by hospitalId or patientMedId).
 */
export async function getRequests(filters = {}) {
  let q = collection(db, "requests");
  const constraints = [];

  if (filters.hospitalId) {
    constraints.push(where("hospitalId", "==", filters.hospitalId));
  }
  if (filters.patientMedId) {
    constraints.push(where("patientMedId", "==", filters.patientMedId));
  }
  if (filters.status) {
    constraints.push(where("status", "==", filters.status));
  }

  if (constraints.length) {
    q = query(q, ...constraints);
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch ALL requests (police needs to see all pending ones).
 */
export async function getAllRequests() {
  const snap = await getDocs(collection(db, "requests"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time listener on ALL requests — calls cb(requests[]) on every change.
 * Returns the unsubscribe function.
 */
export function listenRequests(cb) {
  return onSnapshot(collection(db, "requests"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
