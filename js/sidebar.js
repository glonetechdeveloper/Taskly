/* ==========================================================
   TASKLY — sidebar.js
   Dynamic controller for Modern Study Case Sidebar
   - Ultra-responsive mobile drawer with gestures & scroll lock
   - Collapse / Expand toggle with local storage persistence
   - Hover tooltips in collapsed desktop mode
   - Light / Dark theme toggle applied globally
   - User profile footer widget sync
   - Active page highlights & dynamic notification badges
   ========================================================== */

(function () {
  const SidebarController = {
    init() {
      this.initTheme();
      this.initCollapseState();
      this.initUserInfo();
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
      if (window.TasklyAPI && typeof window.TasklyAPI.emit === "function") {
        window.TasklyAPI.emit("taskly:theme-changed", { theme: next });
      }
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

    initUserInfo() {
      const nameEl = document.getElementById("sidebarUserName");
      const emailEl = document.getElementById("sidebarUserEmail");
      const avatarEl = document.getElementById("sidebarUserAvatar");

      try {
        const rawName = localStorage.getItem("taskly_user_name") || "";
        const rawEmail = localStorage.getItem("taskly_user_email") || "";

        if (nameEl) {
          if (rawName.trim()) {
            nameEl.textContent = rawName.trim();
          } else if (rawEmail) {
            nameEl.textContent = rawEmail.split("@")[0];
          } else {
            nameEl.textContent = "Taskly User";
          }
        }

        if (emailEl) {
          emailEl.textContent = rawEmail || "user@taskly.app";
        }

        const customAvatar = localStorage.getItem("taskly_user_avatar");
        if (avatarEl && customAvatar) {
          avatarEl.src = customAvatar;
        }
      } catch (e) {}
    },

    initActiveItem() {
      const path = window.location.pathname.toLowerCase();
      const links = document.querySelectorAll(".sidebar-link");

      links.forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        link.classList.remove("is-active");

        if (href) {
          if (path.endsWith(href) || (href === "dashboard.html" && (path.endsWith("/") || path.endsWith("index.html") || path === ""))) {
            link.classList.add("is-active");
          }
        }
      });

      // Check settings active
      const settingsBtn = document.getElementById("sidebarSettingsBtn");
      if (settingsBtn) {
        if (path.endsWith("settings.html")) {
          settingsBtn.classList.add("is-active");
        } else {
          settingsBtn.classList.remove("is-active");
        }
      }

      // Check profile active
      const profileLink = document.getElementById("sidebarProfileLink");
      if (profileLink) {
        if (path.endsWith("account.html")) {
          profileLink.parentElement?.classList.add("is-active");
        } else {
          profileLink.parentElement?.classList.remove("is-active");
        }
      }
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

      const elementsWithTooltip = [
        ...document.querySelectorAll(".sidebar-link"),
        document.getElementById("sidebarNewChatBtn"),
        document.getElementById("sidebarProfileLink"),
        document.getElementById("sidebarSettingsBtn"),
        document.getElementById("sidebarThemeSwitch")
      ].filter(Boolean);

      elementsWithTooltip.forEach((el) => {
        const labelEl = el.querySelector(".sidebar-link-label") || el.querySelector(".sidebar-profile-name");
        const titleText = el.getAttribute("title") || (labelEl ? labelEl.textContent.trim() : "");

        el.addEventListener("mouseenter", () => {
          if (document.body.classList.contains("sidebar-is-collapsed") && window.innerWidth > 900 && titleText) {
            const rect = el.getBoundingClientRect();
            tooltip.textContent = titleText;
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.classList.add("is-visible");
          }
        });

        el.addEventListener("mouseleave", () => {
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
      document.querySelectorAll(".sidebar-link, .sidebar-profile-link, .sidebar-settings-btn").forEach((link) => {
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

      // Navbar Topbar Profile Avatar click -> Redirect to account.html
      document.querySelectorAll(".topbar-avatar, #topbarAvatar").forEach((avatar) => {
        avatar.style.cursor = "pointer";
        avatar.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = "account.html";
        });
      });

      // New Chat & Chat with Nodi triggers
      document.querySelectorAll(".open-nodi-modal, #sidebarChatBtn, #sidebarNewChatBtn, #askNodiSidebar").forEach((btn) => {
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

      // Logout triggers (only when explicitly present)
      document.querySelectorAll(".btn-sidebar-logout, #sidebarLogoutBtn, #openLogoutBtn").forEach((btn) => {
        if (btn.id === "openLogoutBtn") return; // Handled by page modal
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
    },

    renderNavbarNotifications() {
      const panel = document.getElementById("notifPanel");
      const dot = document.getElementById("notifDot");
      if (!panel) return;

      let notifs = [];
      try {
        const raw = localStorage.getItem("taskly_notifications");
        notifs = raw ? JSON.parse(raw) : [];
      } catch (e) {
        notifs = [];
      }

      if (notifs.length === 0) {
        notifs = [
          { id: "n1", message: "Welcome to Taskly! Create your first roadmap to get started.", read: false, created_at: new Date().toISOString() },
          { id: "n2", message: "You're on a 5 day streak. Keep it going today!", read: true, created_at: new Date(Date.now() - 3600000).toISOString() }
        ];
        try { localStorage.setItem("taskly_notifications", JSON.stringify(notifs)); } catch (e) {}
      }

      const unreadList = notifs.filter(n => !n.read);
      const readList = notifs.filter(n => n.read);

      if (dot) dot.style.display = unreadList.length > 0 ? "block" : "none";

      // Combine: unread on top, then read, max 5 items total
      const combined = [...unreadList, ...readList].slice(0, 5);

      panel.innerHTML = `
        <div class="dropdown-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Notifications</span>
          ${unreadList.length > 0 ? '<button id="markAllReadNavBtn" type="button" style="background:none; border:none; color:var(--color-teal); font-size:11.5px; font-weight:700; cursor:pointer;">Mark all read</button>' : ''}
        </div>
        <div class="notif-dropdown-list" style="max-height: 320px; overflow-y: auto;">
          ${combined.length === 0 ? `
            <div style="padding: 20px 16px; text-align: center; color: #94A3B8; font-size: 13px;">No notifications</div>
          ` : combined.map(n => `
            <div class="notif-item ${n.read ? 'is-read' : 'is-unread'}" data-notif-id="${n.id}" style="padding: 10px 14px; border-bottom: 1px solid var(--color-border, #f1f5f9); background: ${n.read ? 'transparent' : 'rgba(13, 148, 136, 0.05)'}; cursor: pointer; transition: background 0.15s ease;">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <div class="notif-icon ${n.type === 'milestone' ? 'is-teal' : ''}" style="width:28px; height:28px; border-radius:50%; background: ${n.read ? '#F1F5F9' : '#CCFBF1'}; color: ${n.read ? '#94A3B8' : '#0D9488'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/></svg>
                </div>
                <div style="flex:1; min-width:0;">
                  <p style="font-size:12.5px; line-height:1.4; margin:0; font-weight:${n.read ? '500' : '700'}; color:var(--color-ink, #0f172a);">${n.message}</p>
                  <span style="font-size:11px; color:#94A3B8; margin-top:2px; display:block;">${n.read ? 'Read' : '• Unread'}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dropdown-footer" style="padding:8px; text-align:center; border-top:1px solid var(--color-border, #f1f5f9);">
          <a href="notifications.html" class="view-all-btn" style="color:var(--color-teal, #0d9488); font-weight:700; font-size:12.5px; text-decoration:none;">View all notifications</a>
        </div>
      `;

      // Mark single item as read on click
      panel.querySelectorAll(".notif-item").forEach(item => {
        item.addEventListener("click", () => {
          const id = item.dataset.notifId;
          const found = notifs.find(n => n.id === id);
          if (found) {
            found.read = true;
            try { localStorage.setItem("taskly_notifications", JSON.stringify(notifs)); } catch (e) {}
            this.renderNavbarNotifications();
          }
        });
      });

      // Mark all read button
      const markBtn = document.getElementById("markAllReadNavBtn");
      if (markBtn) {
        markBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          notifs.forEach(n => n.read = true);
          try { localStorage.setItem("taskly_notifications", JSON.stringify(notifs)); } catch (e) {}
          this.renderNavbarNotifications();
        });
      }
    }
  };

  window.SidebarController = SidebarController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SidebarController.init());
  } else {
    SidebarController.init();
  }
})();
