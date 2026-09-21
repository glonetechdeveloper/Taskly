/* ==========================================================
   TASKLY — pwa.js
   Progressive Web App Controller
   - Service Worker Registration & Lifecycle
   - beforeinstallprompt Listener & Custom UI Triggers
   - PC Taskbar & Desktop Installation Handling
   - Mobile (Android & iOS Safari) Add-to-Home-Screen Support
   ========================================================== */

(function () {
  let deferredPrompt = null;
  let isInstalled = false;

  // Check if already running in standalone mode (installed PWA)
  function checkIsStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://")
    );
  }

  // Check if current device is iOS Safari
  function isIos() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
  }

  const PWAController = {
    init() {
      isInstalled = checkIsStandalone();
      this.registerServiceWorker();
      this.initInstallPromptListener();
      this.injectInstallUI();
      this.wireEvents();
      this.updateUIState();
    },

    registerServiceWorker() {
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("./sw.js")
            .then((registration) => {
              console.log("[PWA] Service Worker registered with scope:", registration.scope);

              // Check for updates
              registration.addEventListener("updatefound", () => {
                const newWorker = registration.installing;
                if (newWorker) {
                  newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                      console.log("[PWA] New version of Taskly is available.");
                    }
                  });
                }
              });
            })
            .catch((err) => {
              console.warn("[PWA] Service Worker registration failed:", err);
            });
        });
      }
    },

    initInstallPromptListener() {
      window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent default mini-infobar on mobile
        e.preventDefault();
        deferredPrompt = e;
        console.log("[PWA] beforeinstallprompt captured.");
        this.showInstallButtons();
        this.updateUIState();
      });

      window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        isInstalled = true;
        console.log("[PWA] Taskly app was successfully installed!");
        this.hideInstallButtons();
        this.showInstalledToast();
        this.updateUIState();
      });
    },

    async triggerInstall() {
      // 1. If deferredPrompt is ready (Chrome, Edge, Android, Desktop)
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          console.log("[PWA] User choice:", choice.outcome);
          if (choice.outcome === "accepted") {
            deferredPrompt = null;
            this.hideInstallButtons();
          }
        } catch (err) {
          console.warn("[PWA] Error triggering install prompt:", err);
        }
        return;
      }

      // 2. If on iOS Safari, show the iOS specific step-by-step modal
      if (isIos() && !isInstalled) {
        this.openIosInstallModal();
        return;
      }

      // 3. If already installed
      if (isInstalled) {
        this.showToast("Taskly is already installed on this device!", "success");
        return;
      }

      // 4. Fallback instruction modal for desktop/browsers without native prompt
      this.openGeneralInstallModal();
    },

    showInstallButtons() {
      document.querySelectorAll(".pwa-install-trigger, #sidebarPwaBtn, #installPwaBanner").forEach((el) => {
        el.style.display = "";
        el.classList.remove("is-hidden");
      });
    },

    hideInstallButtons() {
      document.querySelectorAll(".pwa-install-trigger, #sidebarPwaBtn, #installPwaBanner, #pwaInstallBanner").forEach((el) => {
        el.style.display = "none";
        el.classList.add("is-hidden");
      });
    },

    updateUIState() {
      if (isInstalled) {
        this.hideInstallButtons();
        document.querySelectorAll(".pwa-status-badge").forEach((badge) => {
          badge.textContent = "Installed (App Mode)";
          badge.className = "pwa-status-badge is-installed";
        });
      }
    },

    showInstalledToast() {
      this.showToast("🎉 Taskly installed! You can now launch it directly from your taskbar or home screen.", "success");
    },

    showToast(msg, type = "success") {
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = msg;
        toast.className = `toast is-visible ${type === "success" ? "is-success" : "is-error"}`;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4500);
      }
    },

    injectInstallUI() {
      // 1. Check if sidebar has PWA install item; if not and sidebar exists, inject it nicely
      const sidebarNav = document.querySelector(".sidebar-nav");
      if (sidebarNav && !document.getElementById("sidebarPwaItem")) {
        const item = document.createElement("li");
        item.id = "sidebarPwaItem";
        item.className = "sidebar-item";
        item.innerHTML = `
          <button type="button" class="sidebar-link sidebar-pwa-btn pwa-install-trigger" id="sidebarPwaBtn" title="Install Taskly App" aria-label="Install Taskly on your device">
            <span class="sidebar-link-icon" style="color:var(--color-teal, #0D9488);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </span>
            <span class="sidebar-link-label">Install App</span>
            <span class="sidebar-badge" style="background:#CCFBF1; color:#0D9488; font-size:10.5px; font-weight:700; padding:2px 6px; border-radius:6px; margin-left:auto;">PWA</span>
          </button>
        `;
        // Insert right before the last elements or append
        sidebarNav.appendChild(item);
      }

      // 2. Inject global PWA install modal if not present
      if (!document.getElementById("pwaInstallModalOverlay")) {
        const modalOverlay = document.createElement("div");
        modalOverlay.id = "pwaInstallModalOverlay";
        modalOverlay.className = "modal-overlay";
        modalOverlay.setAttribute("role", "dialog");
        modalOverlay.setAttribute("aria-modal", "true");
        modalOverlay.innerHTML = `
          <div class="modal pwa-install-modal" style="max-width: 440px; text-align: center; padding: 28px 24px;">
            <div style="width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px; background: #CCFBF1; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px -5px rgba(13, 148, 136, 0.25);">
              <img src="assets/Icon.png" alt="Taskly" style="width: 44px; height: 44px; object-fit: contain;">
            </div>
            <h3 style="font-family: var(--font-display, inherit); font-size: 20px; font-weight: 800; margin: 0 0 8px; color: var(--color-ink, #0F172A);">Install Taskly App</h3>
            <p style="font-size: 13.5px; line-height: 1.5; color: var(--color-ink-soft, #64748B); margin: 0 0 20px;">
              Add Taskly to your desktop taskbar or phone home screen for offline access, fullscreen experience, and instant roadmap generation.
            </p>

            <div id="pwaModalIosGuide" style="display: none; background: rgba(13, 148, 136, 0.06); border: 1px dashed var(--color-teal, #0D9488); border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 20px;">
              <p style="font-weight: 700; font-size: 13px; margin: 0 0 8px; color: var(--color-teal, #0D9488);">📱 Instructions for iPhone & iPad (Safari):</p>
              <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; line-height: 1.6; color: var(--color-ink, #0F172A);">
                <li>Tap the <strong>Share</strong> icon <span style="font-size: 15px;">⎋</span> at the bottom of Safari.</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong> <span style="font-size: 15px;">⊞</span>.</li>
                <li>Tap <strong>"Add"</strong> in the top right corner.</li>
              </ol>
            </div>

            <div id="pwaModalDesktopGuide" style="display: none; background: #F8FAFC; border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 20px; border: 1px solid #E2E8F0;">
              <p style="font-weight: 700; font-size: 13px; margin: 0 0 8px; color: #0F172A;">💻 Desktop Installation:</p>
              <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; color: #475569;">
                <li>Click the <strong>"Install"</strong> icon in your browser address bar (top right).</li>
                <li>Or click the 3 dots menu <span style="font-weight: 700;">⋮</span> &rarr; <strong>"Install Taskly"</strong> / <strong>"Save and share"</strong>.</li>
              </ul>
            </div>

            <div style="display: flex; gap: 10px; justify-content: center;">
              <button type="button" class="btn btn-secondary" id="pwaModalCloseBtn" style="flex: 1; padding: 10px 16px; font-size: 13.5px; font-weight: 600; border-radius: 10px;">Maybe Later</button>
              <button type="button" class="btn btn-primary" id="pwaModalInstallBtn" style="flex: 1; padding: 10px 16px; font-size: 13.5px; font-weight: 700; border-radius: 10px; background: var(--color-teal, #0D9488); color: #fff;">Install Now</button>
            </div>
          </div>
        `;
        document.body.appendChild(modalOverlay);
      }
    },

    openIosInstallModal() {
      const overlay = document.getElementById("pwaInstallModalOverlay");
      const iosGuide = document.getElementById("pwaModalIosGuide");
      const desktopGuide = document.getElementById("pwaModalDesktopGuide");
      const installBtn = document.getElementById("pwaModalInstallBtn");

      if (overlay) {
        if (iosGuide) iosGuide.style.display = "block";
        if (desktopGuide) desktopGuide.style.display = "none";
        if (installBtn) installBtn.style.display = "none"; // iOS needs manual share step
        overlay.classList.add("is-open");
      }
    },

    openGeneralInstallModal() {
      const overlay = document.getElementById("pwaInstallModalOverlay");
      const iosGuide = document.getElementById("pwaModalIosGuide");
      const desktopGuide = document.getElementById("pwaModalDesktopGuide");
      const installBtn = document.getElementById("pwaModalInstallBtn");

      if (overlay) {
        if (iosGuide) iosGuide.style.display = "none";
        if (desktopGuide) desktopGuide.style.display = deferredPrompt ? "none" : "block";
        if (installBtn) installBtn.style.display = deferredPrompt ? "block" : "none";
        overlay.classList.add("is-open");
      }
    },

    closeInstallModal() {
      const overlay = document.getElementById("pwaInstallModalOverlay");
      if (overlay) overlay.classList.remove("is-open");
    },

    wireEvents() {
      // Universal click triggers on any element with data-pwa-install or matching classes
      document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-pwa-install], .pwa-install-trigger, #sidebarPwaBtn, #installAppBtn, #pwaModalInstallBtn");
        if (trigger) {
          e.preventDefault();
          this.closeInstallModal();
          this.triggerInstall();
        }

        const closeTrigger = e.target.closest("#pwaModalCloseBtn, [data-close-pwa-modal]");
        if (closeTrigger) {
          e.preventDefault();
          this.closeInstallModal();
        }

        // Click outside modal
        const overlay = document.getElementById("pwaInstallModalOverlay");
        if (overlay && e.target === overlay) {
          this.closeInstallModal();
        }
      });
    }
  };

  window.TasklyPWA = PWAController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => PWAController.init());
  } else {
    PWAController.init();
  }
})();
