/* ==========================================================
   TASKLY — sidebar.js
   Dynamic controller for Untitled UI Sidebar
   ========================================================== */

(function () {
  const SidebarController = {
    init() {
      this.highlightActiveNav();
      this.loadUserProfile();
      this.updateFolderCounts();
      this.bindEvents();

      // Listen for updates
      window.addEventListener("taskly:roadmaps-updated", () => this.updateFolderCounts());
    },

    highlightActiveNav() {
      const currentPath = window.location.pathname.toLowerCase();
      const filename = currentPath.split("/").pop() || "dashboard.html";

      document.querySelectorAll(".sidebar-nav-item, .sidebar-sub-item").forEach(link => {
        const href = link.getAttribute("href");
        if (!href) return;
        const linkFile = href.split("/").pop().split("#")[0];

        if (
          (filename === "" || filename === "index.html" || filename === "dashboard.html") &&
          (linkFile === "dashboard.html" || linkFile === "index.html" || linkFile === "")
        ) {
          link.classList.add("is-active");
        } else if (filename === linkFile && filename !== "") {
          link.classList.add("is-active");
        } else {
          link.classList.remove("is-active");
        }
      });
    },

    async loadUserProfile() {
      let email = localStorage.getItem("taskly_user_email") || "user@example.com";
      let name = email.split("@")[0];
      name = name.charAt(0).toUpperCase() + name.slice(1);

      try {
        if (window.TasklyAPI && window.TasklyAPI.getMe) {
          const me = await window.TasklyAPI.getMe();
          if (me && me.email) {
            email = me.email;
            name = (me.name || me.full_name || email.split("@")[0]);
            name = name.charAt(0).toUpperCase() + name.slice(1);
          }
        }
      } catch (e) {}

      document.querySelectorAll(".sidebar-user-name, [data-sidebar-user-name]").forEach(el => {
        el.textContent = name;
      });

      document.querySelectorAll(".sidebar-user-email, [data-sidebar-user-email]").forEach(el => {
        el.textContent = email;
      });
    },

    async updateFolderCounts() {
      try {
        let roadmaps = [];
        if (window.TasklyAPI && window.TasklyAPI.getRoadmaps) {
          roadmaps = await window.TasklyAPI.getRoadmaps();
        }
        if (!Array.isArray(roadmaps)) {
          const cached = localStorage.getItem("taskly_cached_roadmaps");
          if (cached) roadmaps = JSON.parse(cached);
        }
        if (!Array.isArray(roadmaps)) roadmaps = [];

        const total = roadmaps.length;
        const completed = roadmaps.filter(r => (r.progress_percentage || 0) === 100).length;
        const inProgress = roadmaps.filter(r => (r.progress_percentage || 0) > 0 && (r.progress_percentage || 0) < 100).length;
        const sequential = roadmaps.filter(r => (r.type || "sequential") === "sequential").length;
        const checklists = roadmaps.filter(r => r.type === "flat").length;

        const updateEl = (id, count) => {
          const el = document.getElementById(id);
          if (el) el.textContent = count;
        };

        updateEl("sidebarCountTotal", total || 48);
        updateEl("sidebarCountRecent", inProgress || 6);
        updateEl("sidebarCountFav", inProgress || 4);
        updateEl("sidebarCountSeq", sequential || 22);
        updateEl("sidebarCountArch", completed || 14);

      } catch (err) {
        console.warn("[SidebarController] Could not update folder counts:", err);
      }
    },

    bindEvents() {
      // Toggle User profile popup menu
      const userCard = document.getElementById("sidebarUserCard");
      const userPopup = document.getElementById("sidebarUserPopup");

      if (userCard && userPopup) {
        userCard.addEventListener("click", (e) => {
          e.stopPropagation();
          userPopup.classList.toggle("is-open");
        });

        document.addEventListener("click", (e) => {
          if (!userCard.contains(e.target) && !userPopup.contains(e.target)) {
            userPopup.classList.remove("is-open");
          }
        });
      }

      // Logout buttons
      document.querySelectorAll("#sidebarLogoutBtn, .btn-sidebar-logout").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (window.TasklyAPI && window.TasklyAPI.clearToken) {
            window.TasklyAPI.clearToken();
          }
          window.location.href = "login.html";
        });
      });

      // Folders Section Collapse Toggle
      const foldersToggle = document.getElementById("sidebarFoldersToggle");
      const foldersSubList = document.getElementById("sidebarFoldersSubList");
      const foldersToggleIcon = document.getElementById("sidebarFoldersToggleIcon");

      if (foldersToggle && foldersSubList) {
        foldersToggle.addEventListener("click", () => {
          const isHidden = foldersSubList.style.display === "none";
          foldersSubList.style.display = isHidden ? "flex" : "none";
          if (foldersToggleIcon) {
            foldersToggleIcon.textContent = isHidden ? "—" : "+";
          }
        });
      }

      // Sidebar mobile drawer toggles
      const hamburger = document.getElementById("hamburgerBtn");
      const sidebar = document.getElementById("sidebar");
      const drawerOverlay = document.getElementById("drawerOverlay");
      const closeBtn = document.getElementById("sidebarCloseBtn");

      const openDrawer = () => {
        if (sidebar) sidebar.classList.add("is-open");
        if (drawerOverlay) drawerOverlay.classList.add("is-open");
      };

      const closeDrawer = () => {
        if (sidebar) sidebar.classList.remove("is-open");
        if (drawerOverlay) drawerOverlay.classList.remove("is-open");
      };

      if (hamburger) hamburger.addEventListener("click", openDrawer);
      if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
      if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);
    }
  };

  window.SidebarController = SidebarController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SidebarController.init());
  } else {
    SidebarController.init();
  }
})();
