/* ==========================================================
   TASKLY — streak.js
   Universal Streak Controller & Live Sync across all pages
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

      // 2. Update modal big count & text
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
        // Mark past days in streak active up to today
        const isActive = idx <= todayIndex && (todayIndex - idx) < Math.max(streakCount, 1);
        
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

    openModal() {
      const overlay = document.getElementById("streakOverlay");
      if (!overlay) return;
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      this.tickCountdown();
      if (cachedStreakData) {
        this.renderStreak(cachedStreakData);
      } else {
        this.loadStreak();
      }
    },

    closeModal() {
      const overlay = document.getElementById("streakOverlay");
      if (!overlay) return;
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    },

    wireEvents() {
      // Streak trigger button(s)
      document.querySelectorAll("#streakBtn, .open-streak-btn, [data-open-streak]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.openModal();
        });
      });

      // Modal close button(s)
      document.querySelectorAll('[data-close-modal="streakOverlay"], #streakOverlay .modal-close').forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.closeModal();
        });
      });

      // Close on clicking backdrop
      const overlay = document.getElementById("streakOverlay");
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            this.closeModal();
          }
        });
      }

      // Close on Escape
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) {
          this.closeModal();
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

  // Auto initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => StreakManager.init());
  } else {
    StreakManager.init();
  }
})();
