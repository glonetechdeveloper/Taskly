/* ==========================================================
   TASKLY — api.js
   Centralized API Client and Authentication Helpers
   ========================================================== */

const API_BASE = window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || "https://your-service.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
}

function setToken(token) {
  if (token) {
    localStorage.setItem("access_token", token);
    localStorage.setItem("taskly_access_token", token);
  }
}

function removeToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("taskly_access_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401) {
      removeToken();
      window.location.href = "login.html";
      return response;
    }

    return response;
  } catch (err) {
    console.error("API Fetch Error:", err);
    throw err;
  }
}

async function authLogin(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  if (!response.ok) {
    const message = (data && (data.detail || data.message)) || "Invalid email or password";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  if (data.access_token) {
    setToken(data.access_token);
  }

  return data;
}

async function authRegister(email, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  if (!response.ok) {
    const message = (data && (data.detail || data.message)) || "Registration failed. Please try again.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  if (data.access_token) {
    setToken(data.access_token);
  }

  return data;
}

async function authGetMe() {
  const response = await apiFetch("/auth/me");
  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return response.json();
}

function authLogout() {
  removeToken();
  window.location.href = "login.html";
}

// Expose globally
window.API_BASE = API_BASE;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.apiFetch = apiFetch;
window.authLogin = authLogin;
window.authRegister = authRegister;
window.authGetMe = authGetMe;
window.authLogout = authLogout;
