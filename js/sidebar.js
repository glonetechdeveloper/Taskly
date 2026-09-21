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
      this.initNotifDropdown();
      this.bindEvents();
      this.initTouchGestures();
    },

    initNotifDropdown() {
      const btn = document.getElementById("notifBtn");
      const panel = document.getElementById("notifPanel");
      const dot = document.getElementById("notifDot");
      if (!btn || !panel) return;

      this.renderNavbarNotifications();

      if (btn.dataset.wiredNotif) return;
      btn.dataset.wiredNotif = "true";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !panel.classList.contains("is-open");
        document.querySelectorAll(".dropdown-panel.is-open").forEach(d => {
          if (d !== panel) d.classList.remove("is-open");
        });
        if (willOpen) {
          panel.classList.add("is-open");
          if (dot) dot.style.display = "none";
          this.renderNavbarNotifications();
        } else {
          panel.classList.remove("is-open");
        }
      });

      document.addEventListener("click", (e) => {
        if (panel.classList.contains("is-open") && !panel.contains(e.target) && !btn.contains(e.target)) {
          panel.classList.remove("is-open");
        }
      });
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
        let notifs = [];
        if (window.TasklyAPI && typeof window.TasklyAPI.getStoredNotifications === "function") {
          notifs = window.TasklyAPI.getStoredNotifications();
        } else {
          const raw = localStorage.getItem("taskly_notifications");
          notifs = raw ? JSON.parse(raw) : [];
        }
        const unread = notifs.filter(n => !n.read);
        if (unread.length > 0) {
          badge.textContent = unread.length;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
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

      // Theme toggle switches (sidebar, settings, or navbar)
      const themeSwitch = document.getElementById("sidebarThemeSwitch");
      if (themeSwitch) {
        themeSwitch.addEventListener("click", () => {
          this.toggleTheme();
        });
      }

      const navbarThemeBtn = document.getElementById("navbarThemeBtn");
      if (navbarThemeBtn) {
        navbarThemeBtn.addEventListener("click", (e) => {
          e.preventDefault();
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
        if (window.TasklyAPI && typeof window.TasklyAPI.getStoredNotifications === "function") {
          notifs = window.TasklyAPI.getStoredNotifications();
        } else {
          const raw = localStorage.getItem("taskly_notifications");
          notifs = raw ? JSON.parse(raw) : [];
        }
      } catch (e) {
        notifs = [];
      }

      const unreadList = notifs.filter(n => !n.read);
      if (dot) dot.style.display = unreadList.length > 0 ? "block" : "none";

      const formatRelativeTime = (iso) => {
        if (!iso) return "Just now";
        try {
          const diff = (Date.now() - new Date(iso).getTime()) / 1000;
          if (diff < 60) return "Just now";
          if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
          if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
          return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
        } catch (e) {
          return "Recently";
        }
      };

      panel.innerHTML = `
        <div class="dropdown-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--color-border, #f1f5f9);">
          <span style="font-weight:700; font-size:13.5px;">Notifications</span>
          ${unreadList.length > 0 ? '<button id="markAllReadNavBtn" type="button" style="background:none; border:none; color:var(--color-teal, #0d9488); font-size:11.5px; font-weight:700; cursor:pointer;">Mark all read</button>' : ''}
        </div>
        <div class="notif-dropdown-list" style="max-height: 320px; overflow-y: auto;">
          ${notifs.length === 0 ? `
            <div style="padding: 24px 16px; text-align: center; color: #94A3B8; font-size: 13px;">No new notifications</div>
          ` : notifs.slice(0, 15).map(n => `
            <div class="notif-item ${n.read ? 'is-read' : 'is-unread'}" data-notif-id="${n.id}" data-roadmap-id="${n.roadmap_id || ''}" style="padding: 10px 14px; border-bottom: 1px solid var(--color-border, #f1f5f9); background: ${n.read ? 'transparent' : 'rgba(13, 148, 136, 0.06)'}; cursor: pointer; transition: background 0.15s ease;">
              <div style="display:flex; gap:10px; align-items:flex-start;">
                <div class="notif-icon ${n.type === 'milestone' || n.type === 'roadmap' ? 'is-teal' : ''}" style="width:28px; height:28px; border-radius:50%; background: ${n.read ? '#F1F5F9' : '#CCFBF1'}; color: ${n.read ? '#94A3B8' : '#0D9488'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="${n.type === 'milestone' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/></svg>
                </div>
                <div style="flex:1; min-width:0;">
                  <p style="font-size:12.5px; line-height:1.4; margin:0; font-weight:${n.read ? '500' : '700'}; color:var(--color-ink, #0f172a);">${n.message}</p>
                  <span style="font-size:11px; color:#94A3B8; margin-top:3px; display:block;">${formatRelativeTime(n.created_at)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dropdown-footer" style="padding:8px; text-align:center; border-top:1px solid var(--color-border, #f1f5f9);">
          <a href="notifications.html" class="view-all-btn" style="color:var(--color-teal, #0d9488); font-weight:700; font-size:12.5px; text-decoration:none;">View all notifications</a>
        </div>
      `;

      // Mark single item as read on click and navigate if roadmap
      panel.querySelectorAll(".notif-item").forEach(item => {
        item.addEventListener("click", () => {
          const id = item.dataset.notifId;
          const rmId = item.dataset.roadmapId;
          const found = notifs.find(n => n.id === id);
          if (found) {
            found.read = true;
            if (window.TasklyAPI && typeof window.TasklyAPI.saveStoredNotifications === "function") {
              window.TasklyAPI.saveStoredNotifications(notifs);
            } else {
              try { localStorage.setItem("taskly_notifications", JSON.stringify(notifs)); } catch (e) {}
            }
            this.renderNavbarNotifications();
          }
          if (rmId) {
            panel.classList.remove("is-open");
            window.location.href = `roadmap.html?id=${encodeURIComponent(rmId)}`;
          }
        });
      });

      // Mark all read button
      const markBtn = document.getElementById("markAllReadNavBtn");
      if (markBtn) {
        markBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.TasklyAPI && typeof window.TasklyAPI.markAllNotificationsRead === "function") {
            window.TasklyAPI.markAllNotificationsRead();
          } else {
            notifs.forEach(n => n.read = true);
            try { localStorage.setItem("taskly_notifications", JSON.stringify(notifs)); } catch (e) {}
          }
          this.renderNavbarNotifications();
        });
      }
    }
  };

  window.addEventListener("taskly:notifications-updated", () => {
    if (window.SidebarController) {
      if (typeof window.SidebarController.renderNavbarNotifications === "function") {
        window.SidebarController.renderNavbarNotifications();
      }
      if (typeof window.SidebarController.initBadges === "function") {
        window.SidebarController.initBadges();
      }
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "taskly_notifications" && window.SidebarController) {
      if (typeof window.SidebarController.renderNavbarNotifications === "function") {
        window.SidebarController.renderNavbarNotifications();
      }
      if (typeof window.SidebarController.initBadges === "function") {
        window.SidebarController.initBadges();
      }
    }
  });

  window.SidebarController = SidebarController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SidebarController.init());
  } else {
    SidebarController.init();
  }
})();
