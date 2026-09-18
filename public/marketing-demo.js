(function () {
  const liveClientPath = "/village-barbers-cobham/";
  const app = document.getElementById("app");
  if (!app || location.pathname.startsWith("/village-barbers-cobham") || location.pathname.startsWith("/t/JB001")) return;

  document.querySelector(".story-section")?.setAttribute("id", "how");
  const laterHow = document.querySelector("section#how:not(.story-section)");
  if (laterHow) laterHow.id = "workflow";

  document.querySelectorAll(`a[href="${liveClientPath}"]`).forEach(link => link.remove());

  const heroActions = document.querySelector(".hero .actions");
  if (heroActions && !heroActions.querySelector("a")) heroActions.remove();

  const customerExperienceFaq = Array.from(document.querySelectorAll("details")).find(item => item.textContent.includes("Can I see the customer experience?"));
  customerExperienceFaq?.remove();
  document.querySelector(".cta")?.remove();
})();
