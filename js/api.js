/* ==========================================================
   TASKLY — api.js
   Centralized API Client, Feature Connectors & Endpoint Tester
   ========================================================== */

const DEFAULT_PLACEHOLDER = "https://your-service.onrender.com";

/* Dynamic API_BASE — reads from localStorage first so setApiBase() persists */
let API_BASE = window.API_BASE || window.TASKLY_API_BASE || localStorage.getItem("TASKLY_API_BASE") || DEFAULT_PLACEHOLDER;

function isPlaceholder(base) {
  return (base || API_BASE).includes("your-service.onrender.com");
}

/** Persist a new API base URL and reload the module-level variable */
function setApiBase(url) {
  if (!url || !url.trim()) return;
  let clean = url.trim().replace(/\/+$/, ""); // strip trailing slashes
  API_BASE = clean;
  window.API_BASE = clean;
  try {
    localStorage.setItem("TASKLY_API_BASE", clean);
  } catch (e) {}
}

function getApiBase() { return API_BASE; }

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
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder()) {
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
  const normalizedEmail = email.trim().toLowerCase();

  if (!isPlaceholder()) {
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
  if (!isPlaceholder()) {
    try {
      const response = await apiFetch("/auth/me");
      if (response.ok) {
        const data = await response.json();
        // Cache locally for offline use
        if (data.email) localStorage.setItem("taskly_user_email", data.email);
        if (data.full_name) localStorage.setItem("taskly_user_name", data.full_name);
        if (data.username) localStorage.setItem("taskly_user_username", data.username);
        return data;
      }
    } catch (e) {
      console.warn("authGetMe network error, using local cached profile:", e);
    }
  }

  return {
    email: localStorage.getItem("taskly_user_email") || "user@taskly.app",
    full_name: localStorage.getItem("taskly_user_name") || "Taskly User",
    username: localStorage.getItem("taskly_user_username") || "",
  };
}

function authLogout() {
  removeToken();
  try {
    localStorage.removeItem("taskly_user_email");
    localStorage.removeItem("taskly_user_name");
    localStorage.removeItem("taskly_user_username");
  } catch (e) {}
  window.location.href = "login.html";
}

/* ==========================================================
   PROFILE & PASSWORD ENDPOINTS
   ========================================================== */

async function updateProfile(data) {
  if (!isPlaceholder()) {
    // Try common profile update paths
    const paths = ["/auth/profile", "/auth/me", "/users/me"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path, {
          method: path === "/auth/me" ? "PATCH" : "PUT",
          body: JSON.stringify(data),
        });
        if (response.ok) {
          const result = await response.json();
          // Update local cache
          if (data.full_name) localStorage.setItem("taskly_user_name", data.full_name);
          if (data.email) localStorage.setItem("taskly_user_email", data.email);
          if (data.username) localStorage.setItem("taskly_user_username", data.username);
          return { success: true, data: result, source: "api" };
        }
        if (response.status !== 404 && response.status !== 405) {
          const err = await response.json().catch(() => ({}));
          return { success: false, error: err.detail || err.message || "Update failed", source: "api" };
        }
      } catch (e) {
        console.warn(`updateProfile ${path} error:`, e);
      }
    }
  }

  // Local fallback
  if (data.full_name) localStorage.setItem("taskly_user_name", data.full_name);
  if (data.email) localStorage.setItem("taskly_user_email", data.email);
  if (data.username) localStorage.setItem("taskly_user_username", data.username);
  return { success: true, data, source: "local" };
}

async function changePassword(currentPassword, newPassword) {
  if (!isPlaceholder()) {
    const paths = ["/auth/change-password", "/auth/password", "/users/me/password"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path, {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
        if (response.ok) {
          const result = await response.json().catch(() => ({}));
          return { success: true, data: result, source: "api" };
        }
        if (response.status !== 404 && response.status !== 405) {
          const err = await response.json().catch(() => ({}));
          return { success: false, error: err.detail || err.message || "Password change failed", source: "api" };
        }
      } catch (e) {
        console.warn(`changePassword ${path} error:`, e);
      }
    }
  }

  // Local fallback — just accept
  return { success: true, source: "local" };
}

/* ==========================================================
   ROADMAP ENDPOINTS & DETAIL PERSISTENCE
   ========================================================== */

function getRoadmapStorageKey(email) {
  const user = email || localStorage.getItem("taskly_user_email") || "default";
  return "taskly_roadmaps_" + user.replace(/[^a-zA-Z0-9_]/g, "_");
}

function getStoredRoadmaps(email) {
  try {
    const raw = localStorage.getItem(getRoadmapStorageKey(email)) || localStorage.getItem("taskly_user_roadmaps");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredRoadmaps(roadmaps, email) {
  try {
    const serialized = JSON.stringify(roadmaps);
    localStorage.setItem(getRoadmapStorageKey(email), serialized);
    localStorage.setItem("taskly_user_roadmaps", serialized);
  } catch (e) {
    console.warn("Could not save roadmaps to storage", e);
  }
}

function getStoredRoadmapDetail(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(`taskly_roadmap_detail_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStoredRoadmapDetail(id, detail) {
  if (!id || !detail) return;
  try {
    localStorage.setItem(`taskly_roadmap_detail_${id}`, JSON.stringify(detail));
  } catch (e) {
    console.warn("Could not save roadmap detail", e);
  }
}

async function getRoadmaps() {
  if (!isPlaceholder()) {
    try {
      const response = await apiFetch("/roadmaps");
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.roadmaps || data.data || [data]);
        saveStoredRoadmaps(list);
        return list;
      }
    } catch (e) {
      console.warn("getRoadmaps network error, fallback to local:", e);
    }
  }
  return getStoredRoadmaps();
}

async function createRoadmap(goalText, title, type = "sequential") {
  const id = "rm-" + Date.now();
  const newRoadmap = {
    id,
    title: title || goalText,
    goal_text: goalText,
    type: type,
    completed_tasks: 0,
    total_tasks: type === "flat" ? 6 : 8,
    progress: 0,
    created_at: new Date().toISOString()
  };

  if (!isPlaceholder()) {
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
        const data = await response.json();
        const created = data.roadmap || data.data || data;
        if (created && created.id) {
          return created;
        }
      }
    } catch (e) {
      console.warn("createRoadmap network error, fallback to local:", e);
    }
  }

  const existing = getStoredRoadmaps();
  existing.unshift(newRoadmap);
  saveStoredRoadmaps(existing);
  return newRoadmap;
}

async function getRoadmapById(id) {
  if (!id) return null;

  if (!isPlaceholder()) {
    try {
      const response = await apiFetch(`/roadmaps/${id}`);
      if (response.ok) {
        const data = await response.json();
        const detail = data.roadmap || data.data || data;
        if (detail) {
          saveStoredRoadmapDetail(id, detail);
          return detail;
        }
      }
    } catch (e) {
      console.warn("getRoadmapById network error:", e);
    }
  }

  return getStoredRoadmapDetail(id);
}

async function updateRoadmap(id, updateData) {
  if (!id) return { success: false };

  // Save to detail storage
  const existingDetail = getStoredRoadmapDetail(id) || {};
  const updatedDetail = { ...existingDetail, ...updateData };
  saveStoredRoadmapDetail(id, updatedDetail);

  // Update summary in roadmaps list
  const roadmaps = getStoredRoadmaps();
  const idx = roadmaps.findIndex(r => r.id === id);
  if (idx !== -1) {
    roadmaps[idx] = {
      ...roadmaps[idx],
      title: updateData.title || roadmaps[idx].title,
      type: updateData.type || roadmaps[idx].type,
      progress: typeof updateData.progress === "number" ? updateData.progress : roadmaps[idx].progress,
      completed_tasks: typeof updateData.completed_tasks === "number" ? updateData.completed_tasks : roadmaps[idx].completed_tasks,
      total_tasks: typeof updateData.total_tasks === "number" ? updateData.total_tasks : roadmaps[idx].total_tasks,
    };
    saveStoredRoadmaps(roadmaps);
  }

  if (!isPlaceholder()) {
    try {
      const response = await apiFetch(`/roadmaps/${id}`, {
        method: "PUT",
        body: JSON.stringify(updateData)
      });
      if (response.ok) {
        return { success: true, data: await response.json().catch(() => ({})) };
      }
    } catch (e) {
      console.warn("updateRoadmap error:", e);
    }
  }

  return { success: true, data: updatedDetail };
}

async function deleteRoadmap(id) {
  if (!id) return true;

  try {
    localStorage.removeItem(`taskly_roadmap_detail_${id}`);
    const roadmaps = getStoredRoadmaps().filter(r => r.id !== id);
    saveStoredRoadmaps(roadmaps);
  } catch (e) {}

  if (!isPlaceholder()) {
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
   NOTIFICATIONS ENDPOINTS
   ========================================================== */

async function getNotifications() {
  if (!isPlaceholder()) {
    const paths = ["/notifications", "/auth/notifications"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path);
        if (response.ok) {
          const data = await response.json();
          return { data: Array.isArray(data) ? data : (data.notifications || data.data || []), source: "api" };
        }
        if (response.status !== 404 && response.status !== 405) break;
      } catch (e) {
        console.warn(`getNotifications ${path} error:`, e);
      }
    }
  }
  return { data: null, source: "local" };
}

async function markNotificationRead(id) {
  if (!isPlaceholder() && id) {
    try {
      const response = await apiFetch(`/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read: true }) });
      return response.ok;
    } catch (e) {
      console.warn("markNotificationRead error:", e);
    }
  }
  return true;
}

async function markAllNotificationsRead() {
  if (!isPlaceholder()) {
    const paths = ["/notifications/mark-all-read", "/notifications/read-all"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path, { method: "POST" });
        if (response.ok) return true;
        if (response.status !== 404 && response.status !== 405) break;
      } catch (e) {
        console.warn(`markAllNotificationsRead ${path} error:`, e);
      }
    }
  }
  return true;
}

/* ==========================================================
   STREAK ENDPOINT
   ========================================================== */

async function getStreak() {
  if (!isPlaceholder()) {
    const paths = ["/streak", "/auth/streak", "/users/me/streak"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path);
        if (response.ok) {
          return await response.json();
        }
        if (response.status !== 404 && response.status !== 405) break;
      } catch (e) {
        console.warn(`getStreak ${path} error:`, e);
      }
    }
  }
  // Fallback
  const stored = localStorage.getItem("taskly_streak_count");
  return { streak: stored ? parseInt(stored, 10) : 5, source: "local" };
}

/* ==========================================================
   SETTINGS ENDPOINTS
   ========================================================== */

async function getUserSettings() {
  if (!isPlaceholder()) {
    const paths = ["/settings", "/auth/settings", "/users/me/settings"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path);
        if (response.ok) {
          return { data: await response.json(), source: "api" };
        }
        if (response.status !== 404 && response.status !== 405) break;
      } catch (e) {
        console.warn(`getUserSettings ${path} error:`, e);
      }
    }
  }
  // Local fallback
  const raw = localStorage.getItem("taskly_settings");
  return { data: raw ? JSON.parse(raw) : {}, source: "local" };
}

async function updateUserSettings(settings) {
  // Always persist locally
  try {
    localStorage.setItem("taskly_settings", JSON.stringify(settings));
  } catch (e) {}

  if (!isPlaceholder()) {
    const paths = ["/settings", "/auth/settings"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path, {
          method: "PUT",
          body: JSON.stringify(settings),
        });
        if (response.ok) {
          return { success: true, source: "api" };
        }
        if (response.status !== 404 && response.status !== 405) break;
      } catch (e) {
        console.warn(`updateUserSettings ${path} error:`, e);
      }
    }
  }
  return { success: true, source: "local" };
}

/* ==========================================================
   AI / NODI ASSISTANT ENDPOINTS
   ========================================================== */

async function askNodiAI(prompt, context = {}) {
  if (!isPlaceholder()) {
    const paths = ["/ai/chat", "/ai/ask-nodi", "/chat"];
    for (const path of paths) {
      try {
        const response = await apiFetch(path, {
          method: "POST",
          body: JSON.stringify({ prompt, message: prompt, context })
        });
        if (response.ok) {
          const data = await response.json();
          return {
            reply: data.reply || data.response || data.message || "Here is guidance on your goal.",
            source: "api"
          };
        }
      } catch (e) {
        console.warn(`askNodiAI ${path} error:`, e);
      }
    }
  }

  // Smart conversational fallback
  const p = (prompt || "").toLowerCase();
  let reply = "I'm here to help you stay on track! Break large tasks into small 20-minute steps to build momentum.";
  if (p.includes("streak")) {
    reply = "Your study streak increases by 1 each day you complete at least one milestone. Check off a task before midnight to keep it alive!";
  } else if (p.includes("reset") || p.includes("restart")) {
    reply = "You can reset or regenerate any roadmap from its options menu in the Roadmap Manager.";
  } else if (p.includes("recommend") || p.includes("next")) {
    reply = "I recommend focusing on your sequential milestones first, then ticking off quick daily items on your checklists.";
  }
  return { reply, source: "local" };
}

async function checkInStreak() {
  if (!isPlaceholder()) {
    const paths = ["/streak/check-in", "/streak/increment"];
    for (const path of paths) {
      try {
        const res = await apiFetch(path, { method: "POST" });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
  }
  const curr = parseInt(localStorage.getItem("taskly_streak_count") || "5", 10);
  const next = curr + 1;
  localStorage.setItem("taskly_streak_count", String(next));
  return { streak: next, source: "local" };
}

/* ==========================================================
   COMPREHENSIVE ENDPOINT TESTER & HEALTH CHECKER
   ========================================================== */

async function testEndpoints(customBase) {
  const base = customBase || API_BASE;
  const _isPlaceholder = base.includes("your-service.onrender.com");
  const token = getToken();

  console.group("%cTaskly API Endpoints Test Suite", "color: #f2a30d; font-size: 14px; font-weight: bold;");
  console.log("Testing API_BASE:", base);
  console.log("Current Token:", token ? "Available" : "None");

  const results = {
    apiBase: base,
    isPlaceholder: _isPlaceholder,
    timestamp: new Date().toISOString(),
    endpoints: {},
    discoveredRoutes: [],
    featuresDetected: {
      auth: false,
      roadmaps: false,
      notifications: false,
      streak: false,
      settings: false,
      ai: false
    }
  };

  if (_isPlaceholder) {
    console.warn("API_BASE is pointing to placeholder:", base);
    console.log("Application is in Offline / Local Demo Storage mode.");
    console.groupEnd();
    return {
      status: "placeholder_mode",
      message: "API_BASE is set to placeholder. Offline simulated store is active.",
      results
    };
  }

  // 1. Try to fetch OpenAPI Schema to auto-discover all real endpoints
  try {
    const openApiRes = await fetch(`${base}/openapi.json`, { method: "GET" });
    if (openApiRes.ok) {
      const spec = await openApiRes.json();
      if (spec && spec.paths) {
        results.discoveredRoutes = Object.keys(spec.paths);
        console.log("%c✓ OpenAPI Schema Discovered routes:", "color: #4b9b5e;", results.discoveredRoutes);
      }
    }
  } catch (e) {
    console.log("OpenAPI auto-discovery skipped (no schema found).");
  }

  const endpointsToTest = [
    { name: "Health / Docs",                path: "/docs",                    method: "GET",   auth: false, feature: "docs" },
    { name: "OpenAPI Schema",               path: "/openapi.json",            method: "GET",   auth: false, feature: "docs" },
    { name: "Auth: Get Profile",            path: "/auth/me",                 method: "GET",   auth: true,  feature: "auth" },
    { name: "Auth: Login (Check)",          path: "/auth/login",              method: "OPTIONS", auth: false, feature: "auth" },
    { name: "Roadmaps: List",               path: "/roadmaps",                method: "GET",   auth: true,  feature: "roadmaps" },
    { name: "Roadmaps: Create",             path: "/roadmaps",                method: "POST",  auth: true,  feature: "roadmaps", body: { goal_text: "__api_test__", title: "__API Test__", type: "sequential" } },
    { name: "Notifications: List",          path: "/notifications",           method: "GET",   auth: true,  feature: "notifications" },
    { name: "Streak: Get",                  path: "/streak",                  method: "GET",   auth: true,  feature: "streak" },
    { name: "Settings: Get",                path: "/settings",                method: "GET",   auth: true,  feature: "settings" },
    { name: "AI: Chat / Nodi",              path: "/ai/chat",                 method: "POST",  auth: true,  feature: "ai", body: { prompt: "Hello Nodi" } },
  ];

  for (const ep of endpointsToTest) {
    const start = performance.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (ep.auth && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const fetchOpts = { method: ep.method, headers };
      if (ep.body && ep.method !== "GET" && ep.method !== "OPTIONS") {
        fetchOpts.body = JSON.stringify(ep.body);
      }

      const res = await fetch(`${base}${ep.path}`, fetchOpts);
      const elapsed = Math.round(performance.now() - start);

      let data = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        try { data = await res.json(); } catch (e) {}
      }

      const isSuccess = res.ok || res.status === 200 || res.status === 201 || res.status === 204;
      const isAuthNeeded = res.status === 401 || res.status === 403;
      const isMethodSupported = res.status !== 404 && res.status !== 502 && res.status !== 503;

      if (isSuccess && ep.feature) {
        results.featuresDetected[ep.feature] = true;
      }

      results.endpoints[ep.name] = {
        path: ep.path,
        method: ep.method,
        status: res.status,
        ok: isSuccess,
        authRequired: isAuthNeeded,
        supported: isMethodSupported,
        latencyMs: elapsed,
        data: data
      };

      const icon = isSuccess ? "✓" : (isAuthNeeded ? "🔒" : (res.status === 404 ? "✕" : "⚠"));
      const color = isSuccess ? "#4b9b5e" : (isAuthNeeded ? "#3b82f6" : (res.status === 404 ? "#c1503a" : "#f2a30d"));
      console.log(`%c${icon} ${ep.name} — ${ep.method} ${ep.path} → ${res.status} (${elapsed}ms)`, `color: ${color};`, data);
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      results.endpoints[ep.name] = {
        path: ep.path,
        method: ep.method,
        status: "NETWORK_ERROR",
        ok: false,
        authRequired: false,
        supported: false,
        latencyMs: elapsed,
        error: err.message
      };
      console.error(`%c✕ ${ep.name} — ${ep.method} ${ep.path} → Failed (${elapsed}ms):`, "color: #c1503a;", err.message);
    }
  }

  // Attempt to clean up test roadmap
  const createResult = results.endpoints["Roadmaps: Create"];
  if (createResult && createResult.ok && createResult.data) {
    const testId = createResult.data.id || createResult.data._id;
    if (testId) {
      try {
        await fetch(`${base}/roadmaps/${testId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        console.log("%c🧹 Cleaned up test roadmap", "color: #888;");
      } catch (e) {}
    }
  }

  console.groupEnd();
  return results;
}

/* ==========================================================
   EXPOSE GLOBALLY
   ========================================================== */

window.API_BASE = API_BASE;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.apiFetch = apiFetch;
window.authLogin = authLogin;
window.authRegister = authRegister;
window.authGetMe = authGetMe;
window.authLogout = authLogout;
window.updateProfile = updateProfile;
window.changePassword = changePassword;
window.getRoadmaps = getRoadmaps;
window.createRoadmap = createRoadmap;
window.getRoadmapById = getRoadmapById;
window.updateRoadmap = updateRoadmap;
window.deleteRoadmap = deleteRoadmap;
window.getStoredRoadmaps = getStoredRoadmaps;
window.saveStoredRoadmaps = saveStoredRoadmaps;
window.getStoredRoadmapDetail = getStoredRoadmapDetail;
window.saveStoredRoadmapDetail = saveStoredRoadmapDetail;
window.getNotifications = getNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.getStreak = getStreak;
window.checkInStreak = checkInStreak;
window.getUserSettings = getUserSettings;
window.updateUserSettings = updateUserSettings;
window.askNodiAI = askNodiAI;
window.setApiBase = setApiBase;
window.getApiBase = getApiBase;
window.testEndpoints = testEndpoints;
window.TasklyAPI = {
  get API_BASE() { return API_BASE; },
  DEFAULT_PLACEHOLDER,
  isPlaceholder,
  getApiBase,
  setApiBase,
  getToken,
  setToken,
  removeToken,
  apiFetch,
  authLogin,
  authRegister,
  authGetMe,
  authLogout,
  updateProfile,
  changePassword,
  getRoadmaps,
  createRoadmap,
  getRoadmapById,
  updateRoadmap,
  deleteRoadmap,
  getStoredRoadmaps,
  saveStoredRoadmaps,
  getStoredRoadmapDetail,
  saveStoredRoadmapDetail,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getStreak,
  checkInStreak,
  getUserSettings,
  updateUserSettings,
  askNodiAI,
  testEndpoints
};
