/* ==========================================================
   TASKLY — sidebar.js
   Dynamic controller for Modern Study Case Sidebar
   - Ultra-responsive mobile drawer with gestures & scroll lock
   - Collapse / Expand toggle with local storage persistence
   - Hover tooltips in collapsed desktop mode
   - Light / Dark theme toggle
   - Active page highlights & dynamic notification badges
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
      this.initTouchGestures();
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

    openDrawer() {
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("drawerOverlay");
      if (sidebar) sidebar.classList.add("is-open");
      if (overlay) overlay.classList.add("is-visible");
      document.body.classList.add("drawer-open");
    },

    closeDrawer() {
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("drawerOverlay");
      if (sidebar) sidebar.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-visible");
      document.body.classList.remove("drawer-open");
    },

    initTouchGestures() {
      const sidebar = document.getElementById("sidebar");
      if (!sidebar) return;

      let startX = 0;
      let currentX = 0;
      let isTouching = false;

      sidebar.addEventListener("touchstart", (e) => {
        if (window.innerWidth > 900) return;
        startX = e.touches[0].clientX;
        isTouching = true;
      }, { passive: true });

      sidebar.addEventListener("touchmove", (e) => {
        if (!isTouching || window.innerWidth > 900) return;
        currentX = e.touches[0].clientX;
      }, { passive: true });

      sidebar.addEventListener("touchend", () => {
        if (!isTouching || window.innerWidth > 900) return;
        // If swiped left by 45px or more, close the drawer
        if (startX - currentX > 45 && currentX !== 0) {
          this.closeDrawer();
        }
        isTouching = false;
        startX = 0;
        currentX = 0;
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
          if (document.body.classList.contains("sidebar-is-collapsed") && window.innerWidth > 900) {
            e.preventDefault();
            this.toggleCollapse();
          }
        });
      }

      // Mobile close button
      const closeBtn = document.getElementById("sidebarCloseBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.closeDrawer();
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
      const overlay = document.getElementById("drawerOverlay");

      if (hamburger) {
        hamburger.addEventListener("click", (e) => {
          e.preventDefault();
          this.openDrawer();
        });
      }

      if (overlay) {
        overlay.addEventListener("click", () => this.closeDrawer());
      }

      // Close drawer on Escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("drawer-open")) {
          this.closeDrawer();
        }
      });

      // Auto close drawer when navigating on mobile
      document.querySelectorAll(".sidebar-link").forEach((link) => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 900) {
            this.closeDrawer();
          }
        });
      });

      // Auto-cleanup on window resize
      window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
          this.closeDrawer();
        }
      });

      // Chat with Nodi triggers
      document.querySelectorAll(".open-nodi-modal, #sidebarChatBtn, #askNodiSidebar").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (window.innerWidth <= 900) {
            this.closeDrawer();
          }
          if (window.NodiAI && typeof window.NodiAI.open === "function") {
            window.NodiAI.open();
          } else {
            const overlay = document.getElementById("nodiOverlay");
            if (overlay) overlay.classList.add("is-open");
          }
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
