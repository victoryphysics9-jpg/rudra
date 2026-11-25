
(function () {
  "use strict";

  const footer = document.getElementById("rudra-footer");
  if (!footer) return;

  const year = footer.querySelector("[data-rudra-year]");
  if (year) year.textContent = new Date().getFullYear();

  // If Font Awesome is not present on a page, keep the footer functional
  // without throwing JavaScript errors.
  footer.querySelectorAll("a[href='#']").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
    });
  });
})();
