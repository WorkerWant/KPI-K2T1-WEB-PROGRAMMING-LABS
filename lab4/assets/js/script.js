document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".more").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      alert("Nothing there");
    });
  });
});
