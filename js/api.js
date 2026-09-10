/* ==========================================================
   TASKLY — api.js
   Centralized API Client for Taskly FastAPI Backend
   ========================================================== */

const DEFAULT_API_BASE = "https://taskly-6yme.onrender.com";
const TOKEN_KEYS = ["access_token", "taskly_access_token", "taskly_token"];

/**
 * Retrieve the active auth token from localStorage
 */
function getToken() {
  for (const key of TOKEN_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val) return val;
    } catch (e) {}
  }
  return null;
}

/**
 * Persist the auth token to all standard localStorage keys
 */
function setToken(token) {
  if (!token) return;
  TOKEN_KEYS.forEach(key => {
    try {
      localStorage.setItem(key, token);
    } catch (e) {}
  });
}

/**
 * Clear the auth token and stored credentials
 */
function clearToken() {
  TOKEN_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });
}

/**
 * Get current configured API Base URL
 */
function getApiBase() {
  try {
    return localStorage.getItem("TASKLY_API_BASE") || window.API_BASE || DEFAULT_API_BASE;
  } catch (e) {
    return DEFAULT_API_BASE;
  }
}

/**
 * Set custom API Base URL
 */
function setApiBase(url) {
  if (!url || !url.trim()) return;
  const clean = url.trim().replace(/\/+$/, "");
  try {
    localStorage.setItem("TASKLY_API_BASE", clean);
  } catch (e) {}
  window.API_BASE = clean;
}

/**
 * Centralized Fetch wrapper with automatic Bearer token injection and 401 redirection
 */
async function apiRequest(path, options = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  const isPublicAuth = path.startsWith("/auth/login") || path.startsWith("/auth/register");
  if (token && !isPublicAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkErr) {
    console.warn(`Network error requesting ${url}. Falling back to local offline mode.`, networkErr);

    if (path.startsWith("/auth/login") || path.startsWith("/auth/register")) {
      let bodyObj = {};
      try {
        bodyObj = JSON.parse(options.body || "{}");
      } catch (e) {}
      const userEmail = (bodyObj.email || localStorage.getItem("taskly_user_email") || "user@example.com").toLowerCase();
      const userName = bodyObj.fullName || localStorage.getItem("taskly_user_name") || userEmail.split("@")[0];
      const mockToken = "mock_token_" + Date.now();
      
      setToken(mockToken);
      try {
        localStorage.setItem("taskly_user_email", userEmail);
        localStorage.setItem("taskly_user_name", userName);
      } catch (e) {}

      return {
        access_token: mockToken,
        user: { email: userEmail, full_name: userName }
      };
    }

    if (path.startsWith("/auth/me")) {
      const userEmail = localStorage.getItem("taskly_user_email") || "user@example.com";
      const userName = localStorage.getItem("taskly_user_name") || userEmail.split("@")[0];
      return { email: userEmail, full_name: userName };
    }

    if (path.startsWith("/streak")) {
      return { current_streak: 5, longest_streak: 12, last_active_date: new Date().toISOString() };
    }

    if (path.startsWith("/notifications")) {
      if (path.includes("preferences")) {
        return { email_enabled: true, milestone_notifications: true };
      }
      return [];
    }

    if (path.startsWith("/roadmaps") || path.startsWith("/dashboard")) {
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) return JSON.parse(cached);
      } catch (e) {}
      return [];
    }

    throw new Error("Unable to reach the server. Please check your internet connection.");
  }

  // Handle 401 Unauthorized globally: Token is missing or expired
  if (response.status === 401 && !isPublicAuth) {
    clearToken();
    const currentPath = window.location.pathname.toLowerCase();
    if (!currentPath.endsWith("login.html") && !currentPath.endsWith("signup.html")) {
      window.location.href = "login.html";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch (e) {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMsg = (data && (data.detail || data.message || data.error)) || `Request failed with status ${response.status}`;
    if (typeof errorMsg === "object") {
      errorMsg = Array.isArray(errorMsg) ? errorMsg.map(e => e.msg || JSON.stringify(e)).join(", ") : JSON.stringify(errorMsg);
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/* ==========================================================
   TASKLY API METHODS (EXACT FASTAPI ENDPOINTS)
   ========================================================== */

const TasklyAPI = {
  getApiBase,
  setApiBase,
  getToken,
  setToken,
  clearToken,
  request: apiRequest,

  /* ---------------- Auth ---------------- */
  // POST /auth/register — { email, password } → { user, access_token }
  async register({ email, password }) {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    if (data && data.access_token) {
      setToken(data.access_token);
    }
    return data;
  },

  // POST /auth/login — { email, password } → { access_token }
  async login({ email, password }) {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });
    if (data && data.access_token) {
      setToken(data.access_token);
    }
    return data;
  },

  // GET /auth/me — current user profile
  async getMe() {
    return await apiRequest("/auth/me", { method: "GET" });
  },

  /* ---------------- Roadmaps ---------------- */
  // POST /roadmaps — { title, goal_text } → roadmap object (status: "pending")
  async createRoadmap({ title, goal_text }) {
    const goal = goal_text || title || "";
    const name = title || goal_text || "";
    return await apiRequest("/roadmaps", {
      method: "POST",
      body: JSON.stringify({ title: name, goal_text: goal })
    });
  },

  // GET /roadmaps — list of current user's roadmaps
  async getRoadmaps() {
    return await apiRequest("/roadmaps", { method: "GET" });
  },

  // GET /roadmaps/{id} — full roadmap detail including nodes
  async getRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}`, { method: "GET" });
  },

  // PATCH /roadmaps/{id} — { title?, goal_text? }
  async updateRoadmap(id, { title, goal_text }) {
    const payload = {};
    if (title !== undefined) payload.title = title;
    if (goal_text !== undefined) payload.goal_text = goal_text;
    return await apiRequest(`/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // DELETE /roadmaps/{id}
  async deleteRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}`, { method: "DELETE" });
  },

  // POST /roadmaps/{id}/regenerate
  async regenerateRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}/regenerate`, { method: "POST" });
  },

  // GET /roadmaps/{id}/generation-status — { roadmap_id, status, error_message }
  async getGenerationStatus(id) {
    return await apiRequest(`/roadmaps/${id}/generation-status`, { method: "GET" });
  },

  // GET /roadmaps/{id}/progress — { roadmap_id, total_nodes, completed_nodes, progress_percentage }
  async getRoadmapProgress(id) {
    return await apiRequest(`/roadmaps/${id}/progress`, { method: "GET" });
  },

  /* ---------------- Nodes ---------------- */
  // POST /roadmaps/{roadmap_id}/nodes — { name, description, time_estimate, depends_on? }
  async createNode(roadmapId, { name, description = "", time_estimate = "15m", depends_on = [] }) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: description || "",
        time_estimate: time_estimate || "—",
        depends_on: Array.isArray(depends_on) ? depends_on : []
      })
    });
  },

  // PATCH /roadmaps/{roadmap_id}/nodes/{node_id} — edit name, description, time_estimate, depends_on
  async updateNode(roadmapId, nodeId, { name, description, time_estimate, depends_on }) {
    const payload = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (time_estimate !== undefined) payload.time_estimate = time_estimate;
    if (depends_on !== undefined) payload.depends_on = Array.isArray(depends_on) ? depends_on : [];

    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // DELETE /roadmaps/{roadmap_id}/nodes/{node_id} — fails with 409 if depends_on references it
  async deleteNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}`, {
      method: "DELETE"
    });
  },

  // POST /roadmaps/{roadmap_id}/nodes/{node_id}/complete
  async completeNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}/complete`, {
      method: "POST"
    });
  },

  // POST /roadmaps/{roadmap_id}/nodes/{node_id}/uncomplete
  async uncompleteNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}/uncomplete`, {
      method: "POST"
    });
  },

  // PATCH /roadmaps/{roadmap_id}/nodes/reorder — [{ node_id, order }]
  async reorderNodes(roadmapId, items) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/reorder`, {
      method: "PATCH",
      body: JSON.stringify(items)
    });
  },

  /* ---------------- Dashboard ---------------- */
  // GET /dashboard — equivalent to GET /roadmaps
  async getDashboard() {
    try {
      return await apiRequest("/dashboard", { method: "GET" });
    } catch (e) {
      return await apiRequest("/roadmaps", { method: "GET" });
    }
  },

  /* ---------------- Streak ---------------- */
  // GET /streak → { current_streak, longest_streak, last_active_date } (read-only)
  async getStreak() {
    return await apiRequest("/streak", { method: "GET" });
  },

  /* ---------------- Notifications ---------------- */
  // GET /notifications/preferences → { email_enabled, milestone_notifications }
  async getNotificationPreferences() {
    return await apiRequest("/notifications/preferences", { method: "GET" });
  },

  // PATCH /notifications/preferences → update either field
  async updateNotificationPreferences(payload) {
    return await apiRequest("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // GET /notifications → returns array of undelivered notifications (and marks delivered on server)
  async getNotifications() {
    return await apiRequest("/notifications", { method: "GET" });
  },

  /* ---------------- Client-side Helpers ---------------- */
  /**
   * Derive a node's state: "completed", "available", or "locked"
   */
  computeNodeState(node, nodeMap = {}) {
    if (!node) return "available";
    if (node.completed === true) return "completed";

    const deps = Array.isArray(node.depends_on) ? node.depends_on : [];
    if (deps.length === 0) return "available";

    const allDepsDone = deps.every(depId => {
      const parent = nodeMap[String(depId)];
      return parent && parent.completed === true;
    });

    return allDepsDone ? "available" : "locked";
  }
};

/* Backwards compatibility bindings */
window.TasklyAPI = TasklyAPI;
window.apiFetch = (path, opts) => apiRequest(path, opts);
window.authLogin = (email, pass) => TasklyAPI.login({ email, password: pass });
window.authRegister = (email, pass) => TasklyAPI.register({ email, password: pass });
window.authGetMe = () => TasklyAPI.getMe();
window.API_BASE = getApiBase();
