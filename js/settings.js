/* ==========================================================
   TASKLY — settings.js
   ========================================================== */
window.TasklySettings = (function () {

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /* ---------- Generic modal plumbing ---------- */
  function openModal(overlayId) {
    closeAllDropdowns();
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.add("is-open");
  }
  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove("is-open");
  }
  function closeAllDropdowns() {
    $all(".dropdown-panel.is-open").forEach((d) => d.classList.remove("is-open"));
  }
  function wireGenericModalClosers() {
    $all("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    $all(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.remove("is-open");
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $all(".modal-overlay.is-open").forEach((o) => o.classList.remove("is-open"));
        closeAllDropdowns();
      }
    });
  }

  /* ---------- Drawer ---------- */
  function wireDrawer() {
    const sidebar = $("#sidebar");
    const overlay = $("#drawerOverlay");
    const openBtn = $("#hamburgerBtn");
    const closeBtn = $("#sidebarCloseBtn");
    if (!sidebar || !overlay) return;
    function open() { sidebar.classList.add("is-open"); overlay.classList.add("is-visible"); }
    function close() { sidebar.classList.remove("is-open"); overlay.classList.remove("is-visible"); }
    openBtn && openBtn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
    $all(".nav-link").forEach((link) => link.addEventListener("click", close));
  }

  /* ---------- Streak ---------- */
  let streakInterval = null;
  function wireStreakPopup() {
    const btn = $("#streakBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      openModal("streakOverlay");
      tickCountdown();
      clearInterval(streakInterval);
      streakInterval = setInterval(tickCountdown, 1000);
    });
  }
  function tickCountdown() {
    const el = $("#streakCountdown");
    if (!el) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, midnight - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function showToast(message, type) {
    const toast = $("#toast") || (function() {
      let t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
      return t;
    })();
    toast.textContent = message;
    toast.className = "toast is-visible" + (type === "success" ? " is-success" : (type === "error" ? " is-error" : ""));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  /* ---------- Notifications ---------- */
  function wireNotifications() {
    const btn = $("#notifBtn");
    const panel = $("#notifPanel");
    const dot = $("#notifDot");
    if (!btn || !panel) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !panel.classList.contains("is-open");
      closeAllDropdowns();
      if (willOpen) { panel.classList.add("is-open"); if (dot) dot.style.display = "none"; }
    });
    document.addEventListener("click", (e) => {
      if (panel.classList.contains("is-open") && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("is-open");
      }
    });
    const viewAll = $("#viewAllNotifsBtn");
    viewAll && viewAll.addEventListener("click", () => { window.location.href = "notifications.html"; });
  }

  /* ---------- Settings Values Persistence ---------- */
  async function loadSettingsForm() {
    let settings = {};
    if (window.TasklyAPI && window.TasklyAPI.getUserSettings) {
      const res = await window.TasklyAPI.getUserSettings();
      settings = res.data || {};
    }

    const pushToggle = $("#pushNotifToggle");
    const emailToggle = $("#emailNotifToggle");
    const soundToggle = $("#soundEffectsToggle");
    const langSelect = $("#languageSelect");
    const tzSelect = $("#timezoneSelect");
    const apiUrlInput = $("#apiBaseUrlInput");

    if (pushToggle && typeof settings.push_notifications === "boolean") pushToggle.checked = settings.push_notifications;
    if (emailToggle && typeof settings.email_reminders === "boolean") emailToggle.checked = settings.email_reminders;
    if (soundToggle && typeof settings.sound_effects === "boolean") soundToggle.checked = settings.sound_effects;
    if (langSelect && settings.language) langSelect.value = settings.language;
    if (tzSelect && settings.timezone) tzSelect.value = settings.timezone;
    if (apiUrlInput) {
      apiUrlInput.value = (window.TasklyAPI && window.TasklyAPI.getApiBase()) || localStorage.getItem("TASKLY_API_BASE") || "https://your-service.onrender.com";
    }

    // Auto-save on change
    const autoSave = async () => {
      const payload = {
        push_notifications: pushToggle ? pushToggle.checked : true,
        email_reminders: emailToggle ? emailToggle.checked : true,
        sound_effects: soundToggle ? soundToggle.checked : true,
        language: langSelect ? langSelect.value : "en",
        timezone: tzSelect ? tzSelect.value : "gmt+1"
      };
      if (window.TasklyAPI && window.TasklyAPI.updateUserSettings) {
        await window.TasklyAPI.updateUserSettings(payload);
      }
    };

    pushToggle && pushToggle.addEventListener("change", autoSave);
    emailToggle && emailToggle.addEventListener("change", autoSave);
    soundToggle && soundToggle.addEventListener("change", autoSave);
    langSelect && langSelect.addEventListener("change", autoSave);
    tzSelect && tzSelect.addEventListener("change", autoSave);
  }

  /* ---------- API Diagnostics Runner ---------- */
  function wireApiDiagnostics() {
    const input = $("#apiBaseUrlInput");
    const saveBtn = $("#saveApiBaseBtn");
    const runBtn = $("#runDiagnosticsBtn");
    const box = $("#diagResultsBox");
    const list = $("#diagResultsList");
    const summaryPill = $("#diagSummaryPill");

    if (saveBtn && input) {
      saveBtn.addEventListener("click", () => {
        const val = input.value.trim();
        if (window.TasklyAPI && window.TasklyAPI.setApiBase) {
          window.TasklyAPI.setApiBase(val);
        } else {
          localStorage.setItem("TASKLY_API_BASE", val);
        }
        showToast("API Base URL saved.", "success");
      });
    }

    $all(".quick-test-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!input) return;
        input.value = btn.dataset.url;
        if (window.TasklyAPI && window.TasklyAPI.setApiBase) {
          window.TasklyAPI.setApiBase(btn.dataset.url);
        }
        showToast("Preset loaded: " + btn.textContent, "success");
      });
    });

    if (runBtn) {
      runBtn.addEventListener("click", async () => {
        const customUrl = input ? input.value.trim() : null;
        if (customUrl && window.TasklyAPI && window.TasklyAPI.setApiBase) {
          window.TasklyAPI.setApiBase(customUrl);
        }

        if (box) box.classList.add("is-visible");
        if (summaryPill) {
          summaryPill.textContent = "Testing...";
          summaryPill.style.background = "#D69E2E";
          summaryPill.style.color = "#1A202C";
        }
        if (list) {
          list.innerHTML = '<div style="padding: 12px; color: #CBD5E0;">Connecting and testing backend endpoints…</div>';
        }

        runBtn.disabled = true;
        try {
          const report = await (window.TasklyAPI ? window.TasklyAPI.testEndpoints(customUrl) : Promise.resolve(null));
          renderDiagReport(report);
        } catch (err) {
          if (list) list.innerHTML = `<div style="padding: 12px; color: #FC8181;">Diagnostics error: ${escapeHtml(err.message)}</div>`;
        } finally {
          runBtn.disabled = false;
        }
      });
    }

    function renderDiagReport(report) {
      if (!list || !report) return;

      if (report.status === "placeholder_mode") {
        if (summaryPill) {
          summaryPill.textContent = "Offline Demo Mode";
          summaryPill.style.background = "#4A5568";
          summaryPill.style.color = "#E2E8F0";
        }
        list.innerHTML = `
          <div style="padding: 10px; line-height: 1.6; color: #E2E8F0;">
            <p style="color: #F6AD55; font-weight: 700;">Active Mode: Offline Local Storage</p>
            <p style="margin-top: 4px; color: #A0AEC0;">
              API_BASE is currently pointing to placeholder service. All user profile edits, roadmap creation, task completion checks, and settings work with full offline simulation.
            </p>
            <p style="margin-top: 8px; color: #68D391;">
              💡 To test your live backend, enter your server URL (e.g. <code>http://localhost:8000</code> or your live Render/Railway URL) and tap "Test All Endpoints".
            </p>
          </div>
        `;
        return;
      }

      const endpoints = report.endpoints || {};
      const keys = Object.keys(endpoints);
      let passed = 0;
      let total = keys.length;

      let html = "";
      keys.forEach((key) => {
        const ep = endpoints[key];
        const isOk = ep.ok;
        if (isOk) passed++;

        const methodLower = (ep.method || "get").toLowerCase();
        let badgeClass = "err";
        let badgeText = `${ep.status || "ERR"}`;

        if (isOk) {
          badgeClass = "ok";
          badgeText = `✓ ${ep.status || 200}`;
        } else if (ep.authRequired) {
          badgeClass = "auth";
          badgeText = `🔒 Auth (401)`;
        } else if (ep.supported) {
          badgeClass = "warn";
          badgeText = `⚠ ${ep.status}`;
        }

        html += `
          <div class="diag-row">
            <div class="diag-row-left">
              <span class="diag-method ${methodLower}">${ep.method}</span>
              <div>
                <span class="diag-name">${escapeHtml(key)}</span>
                <span class="diag-path">${escapeHtml(ep.path)}</span>
              </div>
            </div>
            <div class="diag-row-right">
              <span class="diag-latency">${ep.latencyMs}ms</span>
              <span class="diag-badge ${badgeClass}">${badgeText}</span>
            </div>
          </div>
        `;
      });

      if (report.discoveredRoutes && report.discoveredRoutes.length > 0) {
        html += `
          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #2D3748;">
            <p style="color: #68D391; font-weight: 700; margin-bottom: 6px;">OpenAPI Detected Routes (${report.discoveredRoutes.length}):</p>
            <div style="color: #A0AEC0; font-size: 11px; line-height: 1.5;">
              ${report.discoveredRoutes.map(r => `<span style="display: inline-block; background: #23272F; padding: 2px 6px; border-radius: 4px; margin: 2px;">${escapeHtml(r)}</span>`).join(" ")}
            </div>
          </div>
        `;
      }

      list.innerHTML = html;

      if (summaryPill) {
        summaryPill.textContent = `${passed}/${total} Endpoints Active`;
        summaryPill.style.background = passed > 0 ? "#276749" : "#9B2C2C";
        summaryPill.style.color = "#FFFFFF";
      }
    }
  }

  /* ---------- Ask Nodi ---------- */
  function wireNodiModal() {
    const openBtn = $("#nodiBtn");
    const input = $("#nodiInput");
    const sendBtn = $("#nodiSendBtn");
    const body = $("#nodiBody");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
      openModal("nodiOverlay");
      setTimeout(() => input && input.focus(), 250);
    });

    function appendBubble(text, from) {
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble from-" + from;
      bubble.textContent = text;
      body.appendChild(bubble);
      body.scrollTop = body.scrollHeight;
    }

    async function sendMessage(text) {
      const msg = (text || (input ? input.value : "")).trim();
      if (!msg) return;
      appendBubble(msg, "user");
      if (input) input.value = "";
      const typing = document.createElement("div");
      typing.className = "chat-bubble from-nodi";
      typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      if (window.TasklyAPI && window.TasklyAPI.askNodiAI) {
        try {
          const res = await window.TasklyAPI.askNodiAI(msg);
          typing.remove();
          appendBubble(res.reply, "nodi");
          return;
        } catch (e) {}
      }

      setTimeout(() => {
        typing.remove();
        appendBubble("You can test endpoints, configure audio feedback, or manage your roadmap preferences anytime!", "nodi");
      }, 900);
    }

    sendBtn && sendBtn.addEventListener("click", () => sendMessage());
    input && input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
    $all(".suggestion-chip").forEach((chip) => chip.addEventListener("click", () => sendMessage(chip.textContent)));
  }

  function init() {
    document.addEventListener("DOMContentLoaded", () => {
      wireGenericModalClosers();
      wireDrawer();
      wireStreakPopup();
      wireNotifications();
      wireNodiModal();
      loadSettingsForm();
      wireApiDiagnostics();
    });
  }

  return { init, loadSettingsForm, wireApiDiagnostics };
})();

if (typeof window !== "undefined" && window.TasklySettings) {
  window.TasklySettings.init();
}

