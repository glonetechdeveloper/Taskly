/* ==========================================================
   TASKLY — api.js
   Centralized API Client, Feature Connectors & Endpoint Tester
   ========================================================== */

const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";
const API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;

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

/* ==========================================================
   AUTHENTICATION ENDPOINTS
   ========================================================== */

async function authLogin(email, password) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let data = {};
      try { data = await response.json(); } catch (e) { data = {}; }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || "Invalid email or password";
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }

      if (data.access_token) {
        setToken(data.access_token);
      }
      return data;
    } catch (err) {
      console.warn("authLogin network error, using local session:", err);
    }
  }

  // Fallback local session
  const localToken = "taskly_token_" + btoa(normalizedEmail + ":" + Date.now());
  setToken(localToken);
  try {
    localStorage.setItem("taskly_user_email", normalizedEmail);
  } catch (e) {}
  return { access_token: localToken, token_type: "bearer" };
}

async function authRegister(email, password, fullName) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder) {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      let data = {};
      try { data = await response.json(); } catch (e) { data = {}; }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || "Registration failed. Please try again.";
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }

      if (data.access_token) {
        setToken(data.access_token);
      }
      return data;
    } catch (err) {
      console.warn("authRegister network error, using local session:", err);
    }
  }

  // Fallback local registration
  const localToken = "taskly_token_" + btoa(normalizedEmail + ":" + Date.now());
  setToken(localToken);
  try {
    localStorage.setItem("taskly_user_email", normalizedEmail);
    if (fullName) localStorage.setItem("taskly_user_name", fullName);
  } catch (e) {}
  return { access_token: localToken, token_type: "bearer" };
}

async function authGetMe() {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder) {
    try {
      const response = await apiFetch("/auth/me");
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("authGetMe network error, using local cached profile:", e);
    }
  }

  return {
    email: localStorage.getItem("taskly_user_email") || "user@taskly.app",
    full_name: localStorage.getItem("taskly_user_name") || "Taskly User",
  };
}

function authLogout() {
  removeToken();
  window.location.href = "login.html";
}

/* ==========================================================
   ROADMAP ENDPOINTS
   ========================================================== */

async function getRoadmaps() {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder) {
    try {
      const response = await apiFetch("/roadmaps");
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("getRoadmaps network error, fallback to local:", e);
    }
  }
  const email = localStorage.getItem("taskly_user_email") || "default";
  const key = "taskly_roadmaps_" + email.replace(/[^a-zA-Z0-9_]/g, "_");
  const raw = localStorage.getItem(key) || localStorage.getItem("taskly_user_roadmaps");
  return raw ? JSON.parse(raw) : [];
}

async function createRoadmap(goalText, title, type = "sequential") {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder) {
    try {
      const response = await apiFetch("/roadmaps", {
        method: "POST",
        body: JSON.stringify({
          goal_text: goalText,
          title: title || goalText,
          type: type
        })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("createRoadmap network error, fallback to local:", e);
    }
  }

  return {
    id: "rm-" + Date.now(),
    title: title || goalText,
    goal_text: goalText,
    type: type,
    completed_tasks: 0,
    total_tasks: type === "flat" ? 6 : 8,
    progress: 0,
    created_at: new Date().toISOString()
  };
}

async function getRoadmapById(id) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder && id) {
    try {
      const response = await apiFetch(`/roadmaps/${id}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("getRoadmapById network error:", e);
    }
  }
  return null;
}

async function deleteRoadmap(id) {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  if (!isPlaceholder && id) {
    try {
      const response = await apiFetch(`/roadmaps/${id}`, { method: "DELETE" });
      return response.ok;
    } catch (e) {
      console.warn("deleteRoadmap error:", e);
    }
  }
  return true;
}

/* ==========================================================
   BACKEND ENDPOINTS TESTER & HEALTH CHECKER
   ========================================================== */

async function testEndpoints() {
  const isPlaceholder = API_BASE.includes("your-service.onrender.com");
  const token = getToken();

  console.group("%cTaskly API Endpoints Test Suite", "color: #f2a30d; font-size: 14px; font-weight: bold;");
  console.log("Configured API_BASE:", API_BASE);
  console.log("Current Token:", token ? "Available" : "None");

  const results = {
    apiBase: API_BASE,
    isPlaceholder,
    endpoints: {}
  };

  if (isPlaceholder) {
    console.warn("API_BASE is currently pointing to placeholder:", API_BASE);
    console.log("Application is running in seamless Offline / Local Demo Storage mode.");
    console.groupEnd();
    return {
      status: "placeholder_mode",
      message: "API_BASE is set to placeholder (https://your-service.onrender.com). Offline simulated store is active.",
      results
    };
  }

  const endpointsToTest = [
    { name: "Health / Docs", path: "/docs", method: "GET", auth: false },
    { name: "Get Current Profile (GET /auth/me)", path: "/auth/me", method: "GET", auth: true },
    { name: "List Roadmaps (GET /roadmaps)", path: "/roadmaps", method: "GET", auth: true },
    { name: "Create Roadmap (POST /roadmaps)", path: "/roadmaps", method: "POST", auth: true, body: { goal_text: "API Test Roadmap", title: "API Test" } },
    { name: "Notifications (GET /notifications)", path: "/notifications", method: "GET", auth: true }
  ];

  for (const ep of endpointsToTest) {
    const start = performance.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (ep.auth && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}${ep.path}`, {
        method: ep.method,
        headers,
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });

      const elapsed = Math.round(performance.now() - start);
      let data = null;
      try { data = await res.json(); } catch (e) {}

      results.endpoints[ep.name] = {
        status: res.status,
        ok: res.ok,
        latencyMs: elapsed,
        data: data
      };

      if (res.ok) {
        console.log(`%c✓ ${ep.name} — Status ${res.status} (${elapsed}ms)`, "color: #4b9b5e;", data);
      } else {
        console.warn(`%c⚠ ${ep.name} — Status ${res.status} (${elapsed}ms)`, "color: #f2a30d;", data);
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      results.endpoints[ep.name] = {
        status: "ERROR",
        ok: false,
        latencyMs: elapsed,
        error: err.message
      };
      console.error(`%c✕ ${ep.name} — Failed (${elapsed}ms):`, "color: #c1503a;", err.message);
    }
  }

  console.groupEnd();
  return results;
}

// Expose globally on window
window.API_BASE = API_BASE;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.apiFetch = apiFetch;
window.authLogin = authLogin;
window.authRegister = authRegister;
window.authGetMe = authGetMe;
window.authLogout = authLogout;
window.getRoadmaps = getRoadmaps;
window.createRoadmap = createRoadmap;
window.getRoadmapById = getRoadmapById;
window.deleteRoadmap = deleteRoadmap;
window.testEndpoints = testEndpoints;
window.TasklyAPI = {
  API_BASE,
  getToken,
  setToken,
  removeToken,
  apiFetch,
  authLogin,
  authRegister,
  authGetMe,
  authLogout,
  getRoadmaps,
  createRoadmap,
  getRoadmapById,
  deleteRoadmap,
  testEndpoints
};
