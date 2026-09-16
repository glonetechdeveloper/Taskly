/* ==========================================================
   TASKLY — streak.js
   Universal Streak Controller & Dropdown Panel Sync
   Opens as a topbar dropdown panel (matching Notifications)
   ========================================================== */

(function () {
  let streakCountdownInterval = null;
  let cachedStreakData = null;

  const StreakManager = {
    async init() {
      this.wireEvents();
      await this.loadStreak();
      this.tickCountdown();
      if (!streakCountdownInterval) {
        streakCountdownInterval = setInterval(() => this.tickCountdown(), 1000);
      }
    },

    async loadStreak() {
      try {
        if (!window.TasklyAPI || !window.TasklyAPI.getStreak) return;
        const data = await window.TasklyAPI.getStreak();
        if (data && typeof data.current_streak === "number") {
          cachedStreakData = data;
          this.renderStreak(data);
        }
      } catch (err) {
        console.warn("[StreakManager] Failed to fetch streak:", err);
      }
    },

    renderStreak(data) {
      const count = data.current_streak || 0;

      // 1. Update all streak buttons & badge counts in topbar/sidebar
      document.querySelectorAll("#streakBadge, .streak-badge-count, [data-streak-badge]").forEach(el => {
        el.textContent = count;
      });

      document.querySelectorAll("#streakBtn .badge-count, #streakBtn .streak-count").forEach(el => {
        el.textContent = count;
      });

      // 2. Update dropdown big count & text
      document.querySelectorAll("#streakCountBig, .streak-count-big, [data-streak-big]").forEach(el => {
        el.textContent = `${count} ${count === 1 ? "Day" : "Days"}`;
      });

      // 3. Update any inline streak texts
      document.querySelectorAll(".streak-val, [data-streak-val]").forEach(el => {
        el.textContent = count;
      });

      // 4. Render dynamic weekly circles (Mon -> Sun)
      this.renderWeek(count);
    },

    renderWeek(streakCount) {
      const weekContainer = document.getElementById("streakWeek");
      if (!weekContainer) return;

      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const now = new Date();
      // getDay: 0 is Sun, 1 is Mon... convert to 0=Mon, ..., 6=Sun
      const todayIndex = (now.getDay() + 6) % 7;

      weekContainer.innerHTML = days.map((dayName, idx) => {
        const isToday = idx === todayIndex;
        const isActive = streakCount > 0 && idx <= todayIndex && (todayIndex - idx) < streakCount;
        
        return `
          <div class="streak-day">
            <span class="streak-day-dot ${isActive ? 'is-active' : ''} ${isToday ? 'is-today' : ''}">
              ${isActive ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 12l5 5 11-11"/></svg>' : ''}
            </span>
            ${dayName}
          </div>
        `;
      }).join("");
    },

    tickCountdown() {
      const el = document.getElementById("streakCountdown");
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
    },

    openDropdown() {
      const panel = document.getElementById("streakOverlay");
      if (!panel) return;

      // Close notification panel if open
      const notifPanel = document.getElementById("notifPanel");
      if (notifPanel) notifPanel.classList.remove("is-open");

      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      this.tickCountdown();
      if (cachedStreakData) {
        this.renderStreak(cachedStreakData);
      } else {
        this.loadStreak();
      }
    },

    closeDropdown() {
      const panel = document.getElementById("streakOverlay");
      if (!panel) return;
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    },

    toggleDropdown() {
      const panel = document.getElementById("streakOverlay");
      if (!panel) return;
      if (panel.classList.contains("is-open")) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    },

    wireEvents() {
      // Toggle on clicking streak button in topbar or sidebar
      document.querySelectorAll("#streakBtn, .open-streak-btn, [data-open-streak]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleDropdown();
        });
      });

      // Close button inside dropdown
      document.querySelectorAll('[data-close-modal="streakOverlay"], #streakOverlay .modal-close').forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.closeDropdown();
        });
      });

      // Close on clicking outside
      document.addEventListener("click", (e) => {
        const panel = document.getElementById("streakOverlay");
        const btn = document.getElementById("streakBtn");
        if (panel && panel.classList.contains("is-open")) {
          if (!panel.contains(e.target) && !(btn && btn.contains(e.target))) {
            this.closeDropdown();
          }
        }
      });

      // Close streak when notifications button is clicked
      const notifBtn = document.getElementById("notifBtn");
      if (notifBtn) {
        notifBtn.addEventListener("click", () => {
          this.closeDropdown();
        });
      }

      // Close on Escape key
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.closeDropdown();
        }
      });

      // Listen for custom streak-updated events
      window.addEventListener("taskly:streak-updated", () => {
        this.loadStreak();
      });

      // Cross-tab synchronization
      window.addEventListener("storage", (e) => {
        if (e.key === "taskly_sync_event") {
          try {
            const data = JSON.parse(e.newValue || "{}");
            if (data.event === "taskly:streak-updated") {
              this.loadStreak();
            }
          } catch (err) {}
        }
      });
    },

    async refresh() {
      await this.loadStreak();
      if (window.TasklyAPI && window.TasklyAPI.emit) {
        window.TasklyAPI.emit("taskly:streak-updated");
      }
    }
  };

  window.StreakManager = StreakManager;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => StreakManager.init());
  } else {
    StreakManager.init();
  }
})();
