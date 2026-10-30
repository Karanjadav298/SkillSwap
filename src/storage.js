import { seedDatabase } from "./data.js";

const DATABASE_KEY = "skill-swap-board.database.v1";
const SESSION_KEY = "skill-swap-board.session.v1";

export function loadDatabase() {
  try {
    const stored = localStorage.getItem(DATABASE_KEY);
    if (!stored) {
      const initial = structuredClone(seedDatabase);
      saveDatabase(initial);
      return initial;
    }

    const parsed = JSON.parse(stored);
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      learningRequests: Array.isArray(parsed.learningRequests) ? parsed.learningRequests : [],
      exchanges: Array.isArray(parsed.exchanges) ? parsed.exchanges : [],
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
    };
  } catch (error) {
    throw new Error(`Could not load SkillSwap data: ${error.message}`);
  }
}

export function saveDatabase(database) {
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(database));
  } catch (error) {
    throw new Error(`Could not save SkillSwap data: ${error.message}`);
  }
}

export function loadSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch (error) {
    throw new Error(`Could not read the student session: ${error.message}`);
  }
}

export function saveSession(studentId) {
  try {
    localStorage.setItem(SESSION_KEY, studentId);
  } catch (error) {
    throw new Error(`Could not save the student session: ${error.message}`);
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    throw new Error(`Could not end the student session: ${error.message}`);
  }
}

export function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure password hashing is unavailable in this browser. Open the site on localhost using npm run dev.");
  }
  const encoder = new TextEncoder();
  return crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
    .then((key) => crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 120000,
      hash: "SHA-256",
    }, key, 256))
    .then((bits) => [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
}
