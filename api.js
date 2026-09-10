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
 * Centralized Fetch wrapper with automatic Bearer token injection, offline fallback, and 401 redirection
 */
function handleOfflineFallback(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (path.startsWith("/auth/login") || path.startsWith("/auth/register")) {
    let bodyObj = {};
    try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
    const userEmail = (bodyObj.email || localStorage.getItem("taskly_user_email") || "user@example.com").toLowerCase();
    const userName = bodyObj.fullName || localStorage.getItem("taskly_user_name") || userEmail.split("@")[0];
    const userPassword = bodyObj.password || localStorage.getItem("taskly_user_password") || "password123";
    const mockToken = "mock_token_" + Date.now();
    
    setToken(mockToken);
    try {
      localStorage.setItem("taskly_user_email", userEmail);
      localStorage.setItem("taskly_user_name", userName);
      localStorage.setItem("taskly_user_password", userPassword);
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
      if (method === "PATCH") {
        let bodyObj = {};
        try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
        return { email_enabled: bodyObj.email_enabled !== undefined ? bodyObj.email_enabled : true, milestone_notifications: bodyObj.milestone_notifications !== undefined ? bodyObj.milestone_notifications : true };
      }
      return { email_enabled: true, milestone_notifications: true };
    }
    try {
      const stored = localStorage.getItem("taskly_notifications");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  if (path.startsWith("/roadmaps") || path.startsWith("/dashboard")) {
    /* --- POST /roadmaps/{roadmap_id}/nodes → create node offline --- */
    const createNodeMatch = path.match(/\/roadmaps\/([^/]+)\/nodes$/);
    if (method === "POST" && createNodeMatch) {
      const rmId = createNodeMatch[1];
      let bodyObj = {};
      try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
      const newNodeId = "node_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const newNode = {
        id: newNodeId,
        roadmap_id: rmId,
        name: bodyObj.name || "Untitled task",
        description: bodyObj.description || "",
        time_estimate: bodyObj.time_estimate || "—",
        phase: bodyObj.phase || null,
        depends_on: Array.isArray(bodyObj.depends_on) ? bodyObj.depends_on : [],
        completed: false,
        order: 0
      };

      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const rm = list.find(r => r.id === rmId);
          if (rm) {
            if (!Array.isArray(rm.nodes)) rm.nodes = [];
            newNode.order = rm.nodes.length;
            rm.nodes.push(newNode);
            const total = rm.nodes.length;
            const done = rm.nodes.filter(n => n.completed).length;
            rm.progress_percentage = total > 0 ? Math.round((done / total) * 100) : 0;
            localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(list));
          }
        }
      } catch (e) {}
      return newNode;
    }

    /* --- PATCH /roadmaps/{roadmap_id}/nodes/{node_id} → update node offline --- */
    const updateNodeMatch = path.match(/\/roadmaps\/([^/]+)\/nodes\/([^/]+)$/);
    if (method === "PATCH" && updateNodeMatch && !path.includes("/complete") && !path.includes("/uncomplete")) {
      const [, rmId, nodeId] = updateNodeMatch;
      let bodyObj = {};
      try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const rm = list.find(r => r.id === rmId);
          if (rm && Array.isArray(rm.nodes)) {
            const node = rm.nodes.find(n => n.id === nodeId);
            if (node) {
              if (bodyObj.name !== undefined) node.name = bodyObj.name;
              if (bodyObj.description !== undefined) node.description = bodyObj.description;
              if (bodyObj.time_estimate !== undefined) node.time_estimate = bodyObj.time_estimate;
              if (bodyObj.depends_on !== undefined) node.depends_on = bodyObj.depends_on;
              if (bodyObj.phase !== undefined) node.phase = bodyObj.phase;
              if (bodyObj.order !== undefined) node.order = bodyObj.order;
              localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(list));
              return node;
            }
          }
        }
      } catch (e) {}
      return { id: nodeId, ...bodyObj };
    }

    /* --- DELETE /roadmaps/{roadmap_id}/nodes/{node_id} → delete node offline --- */
    if (method === "DELETE" && updateNodeMatch) {
      const [, rmId, nodeId] = updateNodeMatch;
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const rm = list.find(r => r.id === rmId);
          if (rm && Array.isArray(rm.nodes)) {
            rm.nodes = rm.nodes.filter(n => n.id !== nodeId);
            const total = rm.nodes.length;
            const done = rm.nodes.filter(n => n.completed).length;
            rm.progress_percentage = total > 0 ? Math.round((done / total) * 100) : 0;
            localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(list));
          }
        }
      } catch (e) {}
      return null;
    }

    /* --- Complete / Uncomplete node --- */
    if ((method === "POST" || method === "PATCH") && (path.includes("/complete") || path.includes("/uncomplete"))) {
      const parts = path.match(/\/roadmaps\/([^/]+)\/nodes\/([^/]+)\/(?:complete|uncomplete)/) || path.match(/\/roadmaps\/([^/]+)\/nodes\/([^/]+)\/complete/);
      if (parts) {
        const [, rmId, nodeId] = parts;
        const isUncomplete = path.includes("/uncomplete");
        let bodyObj = {};
        try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
        try {
          const cached = localStorage.getItem("taskly_cached_roadmaps");
          if (cached) {
            const list = JSON.parse(cached);
            const rm = list.find(r => r.id === rmId);
            if (rm && Array.isArray(rm.nodes)) {
              const node = rm.nodes.find(n => n.id === nodeId);
              if (node) {
                if (isUncomplete) {
                  node.completed = false;
                } else if (bodyObj.completed !== undefined) {
                  node.completed = bodyObj.completed;
                } else {
                  node.completed = true;
                }
                const total = rm.nodes.length;
                const done = rm.nodes.filter(n => n.completed).length;
                rm.progress_percentage = total > 0 ? Math.round((done / total) * 100) : 0;
                localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(list));
                return node;
              }
            }
          }
        } catch (e) {}
      }
      return { success: true };
    }

    /* --- POST /roadmaps → create a roadmap offline --- */
    if (method === "POST" && path === "/roadmaps") {
      let bodyObj = {};
      try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
      const goalText = bodyObj.goal_text || bodyObj.title || "New Roadmap";
      const title = bodyObj.title || goalText;
      const type = bodyObj.type || "sequential";
      const newId = "rm_" + Date.now();

      /* Generate demo nodes only if sequential; flat checklist starts empty for manual additions */
      const demoNodes = type === "flat" ? [] : [
        { id: newId + "_n1", name: "Research & understand the basics", description: "Gather resources and understand foundational concepts for: " + title, time_estimate: "1-2 hours", completed: false, depends_on: [], order: 0 },
        { id: newId + "_n2", name: "Set up your environment", description: "Prepare everything you need to get started.", time_estimate: "30 min", completed: false, depends_on: [newId + "_n1"], order: 1 },
        { id: newId + "_n3", name: "Practice the core skills", description: "Hands-on practice with the most important elements.", time_estimate: "2-3 hours", completed: false, depends_on: [newId + "_n2"], order: 2 },
        { id: newId + "_n4", name: "Build a small project", description: "Apply what you've learned in a real mini-project.", time_estimate: "3-4 hours", completed: false, depends_on: [newId + "_n3"], order: 3 },
        { id: newId + "_n5", name: "Review & refine", description: "Look back at your progress, fill gaps, and polish.", time_estimate: "1 hour", completed: false, depends_on: [newId + "_n4"], order: 4 }
      ];

      const newRoadmap = {
        id: newId,
        title: title,
        goal_text: goalText,
        type: type,
        status: "done",
        progress_percentage: 0,
        nodes: demoNodes,
        created_at: new Date().toISOString()
      };

      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        const existing = cached ? JSON.parse(cached) : [];
        existing.unshift(newRoadmap);
        localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(existing));
      } catch (e) {}

      return newRoadmap;
    }

    /* --- POST /roadmaps/{id}/regenerate --- */
    if (method === "POST" && path.includes("/regenerate")) {
      return { message: "Roadmap regeneration started" };
    }

    /* --- GET /roadmaps/{id}/generation-status --- */
    if (method === "GET" && path.includes("/generation-status")) {
      const idMatch = path.match(/\/roadmaps\/([^/]+)\/generation-status/);
      return { roadmap_id: idMatch ? idMatch[1] : "", status: "done", error_message: null };
    }

    /* --- GET /roadmaps/{id}/progress --- */
    if (method === "GET" && path.includes("/progress")) {
      const idMatch = path.match(/\/roadmaps\/([^/]+)\/progress/);
      const targetId = idMatch ? idMatch[1] : "";
      let pct = 0;
      let totalNodes = 0;
      let doneNodes = 0;
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const found = list.find(r => r.id === targetId);
          if (found) {
            pct = found.progress_percentage || 0;
            totalNodes = (found.nodes && found.nodes.length) || 0;
            doneNodes = (found.nodes && found.nodes.filter(n => n.completed).length) || 0;
          }
        }
      } catch (e) {}
      return { roadmap_id: targetId, progress_percentage: pct, total_nodes: totalNodes, completed_nodes: doneNodes };
    }

    /* --- PATCH /roadmaps/{id} → rename or update roadmap --- */
    if (method === "PATCH" && path.match(/^\/roadmaps\/([^/]+)$/)) {
      const targetId = path.match(/^\/roadmaps\/([^/]+)$/)[1];
      let bodyObj = {};
      try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const idx = list.findIndex(r => r.id === targetId);
          if (idx !== -1) {
            if (bodyObj.title) list[idx].title = bodyObj.title;
            if (bodyObj.goal_text) list[idx].goal_text = bodyObj.goal_text;
            localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(list));
            return list[idx];
          }
        }
      } catch (e) {}
      return { id: targetId, ...bodyObj };
    }

    /* --- DELETE /roadmaps/{id} → delete roadmap --- */
    if (method === "DELETE" && path.match(/^\/roadmaps\/([^/]+)$/)) {
      const targetId = path.match(/^\/roadmaps\/([^/]+)$/)[1];
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter(r => r.id !== targetId);
          localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(filtered));
        }
      } catch (e) {}
      return { success: true };
    }

    /* --- GET /roadmaps/{id} → return single cached roadmap --- */
    const singleMatch = path.match(/^\/roadmaps\/([^/]+)$/);
    if (method === "GET" && singleMatch) {
      const targetId = singleMatch[1];
      try {
        const cached = localStorage.getItem("taskly_cached_roadmaps");
        if (cached) {
          const list = JSON.parse(cached);
          const found = list.find(r => r.id === targetId);
          if (found) return found;
        }
      } catch (e) {}
      return { id: targetId, title: "Roadmap", type: "sequential", status: "done", progress_percentage: 0, nodes: [] };
    }

    /* --- GET /roadmaps or /dashboard → return cached list --- */
    try {
      const cached = localStorage.getItem("taskly_cached_roadmaps");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  }

  return null;
}

async function apiRequest(path, options = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;
  const token = getToken();

  // If using a local mock session, serve immediately from local offline handler
  if (token && token.startsWith("mock_token_") && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    const offlineRes = handleOfflineFallback(path, options);
    if (offlineRes !== null) return offlineRes;
  }

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
    const offlineData = handleOfflineFallback(path, options);
    if (offlineData !== null) return offlineData;
    throw new Error("Unable to reach the server. Please check your internet connection.");
  }

  // Handle server 5xx errors by falling back to local mode
  if (response.status >= 500) {
    console.warn(`Server returned ${response.status} for ${path}. Using local fallback.`);
    const fallbackData = handleOfflineFallback(path, options);
    if (fallbackData !== null) return fallbackData;
  }

  // Handle 401 Unauthorized: Only kick to login if NOT in mock mode and it's a real expired token
  if (response.status === 401 && !isPublicAuth) {
    if (token && token.startsWith("mock_token_")) {
      const fallbackData = handleOfflineFallback(path, options);
      if (fallbackData !== null) return fallbackData;
    } else {
      clearToken();
      const currentPath = window.location.pathname.toLowerCase();
      if (!currentPath.endsWith("login.html") && !currentPath.endsWith("signup.html")) {
        window.location.href = "login.html";
      }
      throw new Error("Session expired. Please sign in again.");
    }
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
  // POST /roadmaps — { title, goal_text, type } → roadmap object
  async createRoadmap({ title, goal_text, type = "sequential" }) {
    const goal = goal_text || title || "";
    const name = title || goal_text || "";
    return await apiRequest("/roadmaps", {
      method: "POST",
      body: JSON.stringify({ title: name, goal_text: goal, type })
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
