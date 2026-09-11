/* ==========================================================
   TASKLY — sidebar.js
   Dynamic controller for Modern Study Case Sidebar
   - Collapse / Expand toggle with local storage persistence
   - Hover tooltips in collapsed mode
   - Light / Dark theme toggle
   - Active page highlights & notification badges
   ========================================================== */

(function () {
  const SidebarController = {
    init() {
      this.initTheme();
      this.initCollapseState();
      this.initTooltips();
      this.initActiveItem();
      this.initBadges();
      this.bindEvents();
    },

    initTheme() {
      try {
        const savedTheme = localStorage.getItem("taskly_theme") || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
      } catch (e) {}
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("taskly_theme", next);
      } catch (e) {}
    },

    initCollapseState() {
      try {
        const isCollapsed = localStorage.getItem("taskly_sidebar_collapsed") === "true";
        if (isCollapsed && window.innerWidth > 900) {
          document.body.classList.add("sidebar-is-collapsed");
        }
      } catch (e) {}
    },

    toggleCollapse() {
      const isCollapsed = document.body.classList.toggle("sidebar-is-collapsed");
      try {
        localStorage.setItem("taskly_sidebar_collapsed", String(isCollapsed));
      } catch (e) {}
    },

    initActiveItem() {
      const path = window.location.pathname.toLowerCase();
      const links = document.querySelectorAll(".sidebar-link");

      links.forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        link.classList.remove("is-active");

        if (href) {
          if (path.endsWith(href) || (href === "dashboard.html" && (path.endsWith("/") || path.endsWith("index.html")))) {
            link.classList.add("is-active");
          }
        }
      });
    },

    async initBadges() {
      // Sync notifications count badge
      const badge = document.getElementById("sidebarNotifBadge");
      if (!badge) return;

      try {
        if (window.TasklyAPI && typeof window.TasklyAPI.getNotifications === "function") {
          const notifs = await window.TasklyAPI.getNotifications();
          if (Array.isArray(notifs) && notifs.length > 0) {
            badge.textContent = notifs.length;
            badge.style.display = "inline-flex";
          } else {
            badge.style.display = "none";
          }
        }
      } catch (e) {
        badge.style.display = "none";
      }
    },

    initTooltips() {
      let tooltip = document.getElementById("sidebarTooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "sidebarTooltip";
        tooltip.className = "sidebar-tooltip";
        document.body.appendChild(tooltip);
      }

      const links = document.querySelectorAll(".sidebar-link");
      links.forEach((link) => {
        const labelEl = link.querySelector(".sidebar-link-label");
        const titleText = labelEl ? labelEl.textContent.trim() : (link.getAttribute("title") || "");
        
        link.addEventListener("mouseenter", () => {
          if (document.body.classList.contains("sidebar-is-collapsed") && window.innerWidth > 900) {
            const rect = link.getBoundingClientRect();
            tooltip.textContent = titleText;
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.classList.add("is-visible");
          }
        });

        link.addEventListener("mouseleave", () => {
          tooltip.classList.remove("is-visible");
        });
      });
    },

    bindEvents() {
      // Collapse toggle button
      const toggleBtn = document.getElementById("sidebarToggleBtn");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleCollapse();
        });
      }

      // Brand icon click when collapsed will expand sidebar
      const brandIcon = document.getElementById("sidebarBrandIcon");
      if (brandIcon) {
        brandIcon.addEventListener("click", (e) => {
          if (document.body.classList.contains("sidebar-is-collapsed")) {
            e.preventDefault();
            this.toggleCollapse();
          }
        });
      }

      // Theme toggle switch
      const themeSwitch = document.getElementById("sidebarThemeSwitch");
      if (themeSwitch) {
        themeSwitch.addEventListener("click", () => {
          this.toggleTheme();
        });
      }

      // Drawer Open/Close on mobile
      const hamburger = document.getElementById("hamburgerBtn");
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("drawerOverlay");

      function openDrawer() {
        if (sidebar) sidebar.classList.add("is-open");
        if (overlay) overlay.classList.add("is-visible");
      }

      function closeDrawer() {
        if (sidebar) sidebar.classList.remove("is-open");
        if (overlay) overlay.classList.remove("is-visible");
      }

      if (hamburger) hamburger.addEventListener("click", openDrawer);
      if (overlay) overlay.addEventListener("click", closeDrawer);

      // Chat with Nodi triggers
      document.querySelectorAll(".open-nodi-modal, #sidebarChatBtn, #askNodiSidebar").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (window.NodiAI && typeof window.NodiAI.open === "function") {
            window.NodiAI.open();
          } else {
            const overlay = document.getElementById("nodiOverlay");
            if (overlay) overlay.classList.add("is-open");
          }
          if (window.innerWidth <= 900) closeDrawer();
        });
      });

      // Logout triggers
      document.querySelectorAll(".btn-sidebar-logout, #sidebarLogoutBtn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (window.TasklyAPI && typeof window.TasklyAPI.clearToken === "function") {
            window.TasklyAPI.clearToken();
          }
          try {
            localStorage.removeItem("taskly_token");
            localStorage.removeItem("taskly_user_name");
            localStorage.removeItem("taskly_user_email");
          } catch (err) {}
          window.location.href = "login.html";
        });
      });
    }
  };

  window.SidebarController = SidebarController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SidebarController.init());
  } else {
    SidebarController.init();
  }
})();
