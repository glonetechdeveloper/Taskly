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

  if (path.startsWith("/auth/login")) {
    let bodyObj = {};
    try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
    const userEmail = (bodyObj.email || localStorage.getItem("taskly_user_email") || "user@example.com").toLowerCase();
    const mockToken = "mock_token_" + Date.now();
    
    setToken(mockToken);
    try {
      localStorage.setItem("taskly_user_email", userEmail);
    } catch (e) {}

    // POST /auth/login returns ONLY the token shape, NOT a user object
    return {
      access_token: mockToken,
      token_type: "bearer",
      expires_in: 86400
    };
  }

  if (path.startsWith("/auth/register")) {
    let bodyObj = {};
    try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
    const userEmail = (bodyObj.email || localStorage.getItem("taskly_user_email") || "user@example.com").toLowerCase();
    const mockToken = "mock_token_" + Date.now();
    const mockUserId = "mock_user_" + Date.now();
    
    setToken(mockToken);
    try {
      localStorage.setItem("taskly_user_email", userEmail);
    } catch (e) {}

    // POST /auth/register returns token AND user object
    return {
      access_token: mockToken,
      token_type: "bearer",
      expires_in: 86400,
      user: {
        id: mockUserId,
        email: userEmail,
        created_at: new Date().toISOString()
      }
    };
  }

  if (path.startsWith("/auth/me")) {
    const userEmail = localStorage.getItem("taskly_user_email") || "user@example.com";
    return {
      id: "mock_user_1",
      email: userEmail,
      created_at: new Date().toISOString()
    };
  }

  if (path.startsWith("/streak")) {
    return {
      user_id: "mock_user_1",
      current_streak: 5,
      longest_streak: 12,
      last_active_date: new Date().toISOString().split("T")[0]
    };
  }

  if (path.startsWith("/chat")) {
    let bodyObj = {};
    try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
    const rawMsg = String(bodyObj.message || "").trim();
    const msg = rawMsg.toLowerCase();
    
    let reply = "Hey! I'm Nodi, your AI roadmap assistant. I can help list your roadmaps, check progress, generate new learning paths, or complete tasks for you!";
    let actions_taken = [];

    let cachedRoadmaps = [];
    try {
      const cached = localStorage.getItem("taskly_cached_roadmaps");
      if (cached) cachedRoadmaps = JSON.parse(cached);
    } catch (e) {}

    if (msg.includes("roadmap") && (msg.includes("what") || msg.includes("list") || msg.includes("have") || msg.includes("show") || msg.includes("get") || msg.includes("all"))) {
      if (cachedRoadmaps.length > 0) {
        const summaries = cachedRoadmaps.map(r => `'${r.title || r.goal_text}' (${r.progress_percentage || 0}% complete)`).join(", ");
        reply = `You currently have ${cachedRoadmaps.length} roadmap${cachedRoadmaps.length === 1 ? '' : 's'}: ${summaries}.`;
      } else {
        reply = "You don't have any roadmaps created yet. Would you like me to generate one for you?";
      }
      actions_taken = [{ tool: "list_roadmaps", result: `Found ${cachedRoadmaps.length} roadmap${cachedRoadmaps.length === 1 ? '' : 's'}` }];
    } else if (msg.includes("create") || msg.includes("generate") || msg.includes("make roadmap") || msg.includes("new roadmap") || msg.includes("learn ")) {
      const titleCandidate = rawMsg.replace(/^(please\s+)?(can\s+you\s+)?(create|generate|make|build)\s+(a\s+|an\s+)?(new\s+)?(roadmap\s+(for|about|on)?|study\s+plan\s+(for)?|path\s+(for)?)/i, "").trim() || "New Study Roadmap";
      const cleanTitle = titleCandidate.replace(/[.!?]+$/, "");
      const newId = "rm_" + Date.now();
      const newRm = {
        id: newId,
        title: cleanTitle,
        goal_text: cleanTitle,
        type: "sequential",
        status: "done",
        progress_percentage: 0,
        nodes: [
          { id: newId + "_n1", name: `Foundations of ${cleanTitle}`, description: "Core concepts and basics", time_estimate: "1-2 hours", completed: false, depends_on: [], order: 0 },
          { id: newId + "_n2", name: "Practical Hands-on Setup", description: "Configuring the environment and tools", time_estimate: "45 min", completed: false, depends_on: [newId + "_n1"], order: 1 },
          { id: newId + "_n3", name: "Build Real-World Project", description: "Applying learned skills", time_estimate: "3 hours", completed: false, depends_on: [newId + "_n2"], order: 2 }
        ],
        created_at: new Date().toISOString()
      };
      cachedRoadmaps.unshift(newRm);
      try {
        localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(cachedRoadmaps));
      } catch (e) {}
      reply = `I've created a new roadmap for "${cleanTitle}" with step-by-step milestones! You can view and manage it right away.`;
      actions_taken = [{ tool: "create_roadmap", result: `Created roadmap '${cleanTitle}'` }];
    } else if (msg.includes("progress") || msg.includes("status") || msg.includes("how am i doing")) {
      if (cachedRoadmaps.length > 0) {
        const top = cachedRoadmaps[0];
        const totalNodes = (top.nodes && top.nodes.length) || 0;
        const doneNodes = (top.nodes && top.nodes.filter(n => n.completed).length) || 0;
        reply = `For your active roadmap '${top.title || top.goal_text}', you have completed ${doneNodes} of ${totalNodes} milestones (${top.progress_percentage || 0}%). Keep up the great work!`;
        actions_taken = [{ tool: "get_roadmap_progress", result: `Progress for '${top.title || top.goal_text}': ${top.progress_percentage || 0}%` }];
      } else {
        reply = "You don't have any active roadmaps yet to check progress on.";
      }
    } else if (msg.includes("complete") || msg.includes("finish") || msg.includes("mark done") || msg.includes("done with")) {
      let completedNodeName = "Milestone";
      if (cachedRoadmaps.length > 0 && Array.isArray(cachedRoadmaps[0].nodes)) {
        const uncompleted = cachedRoadmaps[0].nodes.find(n => !n.completed);
        if (uncompleted) {
          uncompleted.completed = true;
          completedNodeName = uncompleted.name;
          const total = cachedRoadmaps[0].nodes.length;
          const done = cachedRoadmaps[0].nodes.filter(n => n.completed).length;
          cachedRoadmaps[0].progress_percentage = Math.round((done / total) * 100);
          try {
            localStorage.setItem("taskly_cached_roadmaps", JSON.stringify(cachedRoadmaps));
          } catch (e) {}
        }
      }
      reply = `Awesome! I've marked '${completedNodeName}' as completed and updated your study streak! 🔥`;
      actions_taken = [{ tool: "complete_node", result: `Completed node '${completedNodeName}'` }];
    }

    return {
      reply,
      actions_taken
    };
  }

  if (path.startsWith("/notifications")) {
    if (path.includes("preferences")) {
      if (method === "PATCH") {
        let bodyObj = {};
        try { bodyObj = JSON.parse(options.body || "{}"); } catch (e) {}
        return {
          user_id: "mock_user_1",
          email_enabled: bodyObj.email_enabled !== undefined ? bodyObj.email_enabled : true,
          milestone_notifications: bodyObj.milestone_notifications !== undefined ? bodyObj.milestone_notifications : true
        };
      }
      return {
        user_id: "mock_user_1",
        email_enabled: true,
        milestone_notifications: true
      };
    }
    // GET /notifications is pull-and-consume: returns undelivered items once
    return [];
  }

  if (path.startsWith("/health")) {
    return { status: "ok" };
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
  // POST /roadmaps — Request body (RoadmapCreate): { goal_text, title?, type? }
  async createRoadmap(input = {}) {
    const payload = {};
    if (typeof input === "string") {
      payload.goal_text = input.trim();
    } else if (input && typeof input === "object") {
      const goal = input.goal_text || input.title || "";
      payload.goal_text = String(goal).trim();
      if (input.title) payload.title = String(input.title).trim();
      if (input.type) payload.type = input.type;
    }
    return await apiRequest("/roadmaps", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // GET /roadmaps — list of current user's roadmaps (array of RoadmapSummary)
  async getRoadmaps() {
    return await apiRequest("/roadmaps", { method: "GET" });
  },

  // GET /roadmaps/{id} — full roadmap detail including nodes (RoadmapDetail)
  async getRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}`, { method: "GET" });
  },

  // PATCH /roadmaps/{id} — Request body (RoadmapUpdate): { title?, goal_text? }
  async updateRoadmap(id, { title, goal_text } = {}) {
    const payload = {};
    if (title !== undefined && title !== null) payload.title = String(title).trim();
    if (goal_text !== undefined && goal_text !== null) payload.goal_text = String(goal_text).trim();
    return await apiRequest(`/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // DELETE /roadmaps/{id} — Response 204
  async deleteRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}`, { method: "DELETE" });
  },

  // POST /roadmaps/{id}/regenerate — Response 200 (RoadmapDetail)
  async regenerateRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}/regenerate`, { method: "POST" });
  },

  // GET /roadmaps/{id}/generation-status — Response 200 (GenerationStatus)
  async getGenerationStatus(id) {
    return await apiRequest(`/roadmaps/${id}/generation-status`, { method: "GET" });
  },

  // GET /roadmaps/{id}/progress — Response 200 (Progress)
  async getRoadmapProgress(id) {
    return await apiRequest(`/roadmaps/${id}/progress`, { method: "GET" });
  },

  // POST /roadmaps/{id}/validate — Response 200 (ValidationReport)
  async validateRoadmap(id) {
    return await apiRequest(`/roadmaps/${id}/validate`, { method: "POST" });
  },

  /* ---------------- Nodes ---------------- */
  // POST /roadmaps/{roadmap_id}/nodes — Request body (NodeCreate): { name (required), phase?, description?, time_estimate?, depends_on?, order? }
  async createNode(roadmapId, { name, phase, description, time_estimate, depends_on, order } = {}) {
    const payload = {
      name: String(name || "").trim()
    };
    if (phase !== undefined && phase !== null && String(phase).trim()) {
      payload.phase = String(phase).trim();
    }
    if (description !== undefined && description !== null && String(description).trim()) {
      payload.description = String(description).trim();
    }
    if (time_estimate !== undefined && time_estimate !== null && String(time_estimate).trim()) {
      payload.time_estimate = String(time_estimate).trim();
    }
    if (depends_on !== undefined && Array.isArray(depends_on) && depends_on.length > 0) {
      payload.depends_on = depends_on;
    }
    if (typeof order === "number") {
      payload.order = order;
    }

    return await apiRequest(`/roadmaps/${roadmapId}/nodes`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // PATCH /roadmaps/{roadmap_id}/nodes/{node_id} — Request body (NodeUpdate): all fields optional
  async updateNode(roadmapId, nodeId, data = {}) {
    const payload = {};
    if (data.name !== undefined && data.name !== null) payload.name = String(data.name).trim();
    if (data.phase !== undefined) payload.phase = data.phase ? String(data.phase).trim() : null;
    if (data.description !== undefined) payload.description = data.description ? String(data.description).trim() : null;
    if (data.time_estimate !== undefined) payload.time_estimate = data.time_estimate ? String(data.time_estimate).trim() : null;
    if (data.depends_on !== undefined) payload.depends_on = Array.isArray(data.depends_on) ? data.depends_on : [];
    if (typeof data.order === "number") payload.order = data.order;

    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // DELETE /roadmaps/{roadmap_id}/nodes/{node_id} — Response 204 (409 if depends_on references it)
  async deleteNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}`, {
      method: "DELETE"
    });
  },

  // POST /roadmaps/{roadmap_id}/nodes/{node_id}/complete — Response 200 (NodeOut with completed: true)
  async completeNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}/complete`, {
      method: "POST"
    });
  },

  // POST /roadmaps/{roadmap_id}/nodes/{node_id}/uncomplete — Response 200 (NodeOut with completed: false)
  async uncompleteNode(roadmapId, nodeId) {
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/${nodeId}/uncomplete`, {
      method: "POST"
    });
  },

  // PATCH /roadmaps/{roadmap_id}/nodes/reorder — Request body (ReorderRequest): { items: [{ node_id, order }] }
  async reorderNodes(roadmapId, items) {
    const payload = Array.isArray(items) ? { items } : (items && items.items ? items : { items: [] });
    return await apiRequest(`/roadmaps/${roadmapId}/nodes/reorder`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  /* ---------------- Dashboard ---------------- */
  // GET /dashboard — array of RoadmapSummary (equivalent to GET /roadmaps)
  async getDashboard() {
    try {
      return await apiRequest("/dashboard", { method: "GET" });
    } catch (e) {
      return await apiRequest("/roadmaps", { method: "GET" });
    }
  },

  /* ---------------- Streak ---------------- */
  // GET /streak → UserStreakOut: { user_id, current_streak, longest_streak, last_active_date } (read-only)
  async getStreak() {
    return await apiRequest("/streak", { method: "GET" });
  },

  /* ---------------- Notifications ---------------- */
  // GET /notifications/preferences → NotificationPreferenceOut: { user_id, email_enabled, milestone_notifications }
  async getNotificationPreferences() {
    return await apiRequest("/notifications/preferences", { method: "GET" });
  },

  // PATCH /notifications/preferences → NotificationPreferenceUpdate: { email_enabled?, milestone_notifications? }
  async updateNotificationPreferences(payload = {}) {
    return await apiRequest("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  // GET /notifications → pull-and-consume: array of NotificationOut (marks delivered on read)
  async getNotifications() {
    return await apiRequest("/notifications", { method: "GET" });
  },

  /* ---------------- Chat (Nodi AI) ---------------- */
  // POST /chat — Request body: { message: string } → Response: { reply: string, actions_taken: [{ tool, result }] }
  async chat(message) {
    const text = typeof message === "object" ? message.message : message;
    return await apiRequest("/chat", {
      method: "POST",
      body: JSON.stringify({ message: String(text || "").trim() })
    });
  },

  /* ---------------- Event Bus & App Sync ---------------- */
  emit(eventName, detail = {}) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    try {
      // Sync across tabs/windows
      localStorage.setItem("taskly_sync_event", JSON.stringify({ event: eventName, detail, time: Date.now() }));
    } catch (e) {}
  },

  on(eventName, handler) {
    window.addEventListener(eventName, handler);
  },

  /* ---------------- Meta ---------------- */
  // GET /health → health check (no auth required)
  async checkHealth() {
    return await apiRequest("/health", { method: "GET" });
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
