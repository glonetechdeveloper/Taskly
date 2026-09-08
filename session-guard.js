/* ==========================================================
   TASKLY — session-guard.js
   Route protection for authenticated pages
   ========================================================== */

(function () {
  const token = localStorage.getItem("access_token") || localStorage.getItem("taskly_access_token");
  const path = window.location.pathname.toLowerCase();
  const isAuthPage = path.endsWith("login.html") || path.endsWith("signup.html");

  if (!token && !isAuthPage) {
    // Unauthenticated user trying to access a protected page
    window.location.href = "login.html";
  }
})();
