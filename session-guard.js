/* ==========================================================
   TASKLY — session-guard.js
   Route protection for authenticated pages
   - Immediate token validation on initial load
   - BFCache (back-forward cache) check on 'pageshow' to prevent
     authenticated page access via browser back button after logout
   ========================================================== */

(function () {
  function checkAuth() {
    const token = localStorage.getItem("access_token") || 
                  localStorage.getItem("taskly_access_token") || 
                  localStorage.getItem("taskly_token");
    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.endsWith("login.html") || path.endsWith("signup.html");

    if (!token && !isAuthPage) {
      // Unauthenticated user trying to access a protected page
      window.location.href = "login.html";
    }
  }

  // Initial load execution
  checkAuth();

  // BFCache (pageshow) execution when restored from back/forward history
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      // Page was restored from bfcache, re-check auth before showing anything
      checkAuth();
    }
  });
})();
