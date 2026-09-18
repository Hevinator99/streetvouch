(function () {
  const liveClientPath = "/village-barbers-cobham/";
  const app = document.getElementById("app");
  if (!app) return;

  function showDemoNotice() {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.innerHTML = "<h2>Demo interaction</h2><p>This is a visual preview only. No Google review page has been opened and nothing has been sent.</p><button class=\"btn\">Back to the demo</button>";
    dialog.querySelector("button").onclick = () => dialog.close();
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  function demoChoices() {
    const journey = document.getElementById("demo-journey");
    if (!journey) return;
    journey.innerHTML = `<img class="barber-logo" src="/village-barbers-logo.jpeg" alt="Village Barbers Cobham logo"><div class="shop-name">Village Barbers Cobham</div><h2>Enjoyed your visit?</h2><p class="barber-intro">A quick Google review helps more local people find us.</p><button class="choice choice-primary" type="button" id="demo-google"><span class="google-mark" aria-hidden="true"><span>G</span></span><span><b>Leave a Google review</b><small>Usually takes less than a minute</small></span><span class="arrow" aria-hidden="true">↗</span></button><div class="private-route"><span>Something we should know?</span><button type="button" id="demo-private">Send private feedback</button></div><p class="honesty-note">All honest feedback is welcome.</p><p class="privacy-note">Demonstration only · no information is sent or stored.</p><div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a></div>`;
    document.getElementById("demo-google").onclick = showDemoNotice;
    document.getElementById("demo-private").onclick = demoFeedback;
  }

  function demoFeedback() {
    const journey = document.getElementById("demo-journey");
    if (!journey) return;
    journey.innerHTML = `<button class="back-btn" type="button" id="demo-back">← Back to your options</button><div class="eyebrow">A note for the team</div><h2>We’re listening.</h2><p class="barber-intro">Tell us what worked, what didn’t, or what would make your next visit better.</p><form class="feedback-form" id="demo-feedback"><label for="demo-message">Your feedback</label><textarea id="demo-message" required minlength="3" maxlength="2000" placeholder="Tell us about your experience…"></textarea><div class="field-meta"><span id="demo-count">0</span> / 2,000</div><label for="demo-name">Your name <span class="micro">Optional</span></label><input id="demo-name" type="text" maxlength="100" placeholder="First name" autocomplete="off"><label class="consent"><input id="demo-contact" type="checkbox"><span>I’d like the team to get back to me.</span></label><div id="demo-email-field" hidden><label for="demo-email">Email address</label><input id="demo-email" type="email" autocomplete="off" placeholder="you@example.com"><small class="micro">Shown for the demo only.</small></div><button class="btn form-submit" type="submit">Preview feedback journey <span aria-hidden="true">→</span></button><p class="privacy-note">Demonstration only. Nothing is sent, stored or shared.</p></form><div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a></div>`;
    document.getElementById("demo-back").onclick = demoChoices;
    const message = document.getElementById("demo-message");
    message.oninput = () => { document.getElementById("demo-count").textContent = message.value.length; };
    document.getElementById("demo-contact").onchange = event => {
      const checked = event.target.checked;
      document.getElementById("demo-email-field").hidden = !checked;
      document.getElementById("demo-email").required = checked;
    };
    document.getElementById("demo-feedback").onsubmit = event => {
      event.preventDefault();
      journey.innerHTML = `<div class="success-icon" aria-hidden="true">✓</div><div class="eyebrow">Demo complete</div><h2>That’s all it takes.</h2><p class="barber-intro">In the live version, the shop team would review this privately. This demo has not saved or sent anything.</p><button class="btn form-submit" type="button" id="demo-again">Try the experience again</button><p class="privacy-note">Visual demonstration only.</p><div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a></div>`;
      document.getElementById("demo-again").onclick = demoChoices;
    };
  }

  function renderDemo() {
    document.body.classList.add("barber");
    app.innerHTML = `<div class="demo-banner">Customer experience demonstration · No feedback is sent or stored.</div><main class="barber-layout"><section class="barber-visual" aria-label="Village Barbers Cobham visual demonstration"><img src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1600&q=85" alt="Classic barber chairs in a warm barbershop"><div class="barber-overlay"><div class="barber-wordmark">VILLAGE BARBERS · COBHAM</div><div><h1>Village Barbers<br>Cobham.</h1><p>Thank you for visiting your local barbershop.</p></div></div></section><section class="barber-panel" id="demo-journey" aria-live="polite"></section></main>`;
    demoChoices();
  }

  function updateMarketingLinks() {
    document.querySelector(".story-section")?.setAttribute("id", "how");
    const laterHow = document.querySelector("section#how:not(.story-section)");
    if (laterHow) laterHow.id = "workflow";
    document.querySelectorAll(`a[href="${liveClientPath}"]`).forEach(link => {
      const text = link.textContent.trim();
      if (text.includes("Try the experience") || text.includes("Explore the barber demo")) {
        link.remove();
        return;
      }
      link.href = "/demo";
      if (text.includes("See what your customers see")) link.innerHTML = "See what your customers see <span aria-hidden=\"true\">↗</span>";
      if (text.includes("Open the customer page")) link.textContent = "Open the customer demo ↗";
      if (text.includes("Open the barber pilot")) link.innerHTML = "Open the customer demo <span aria-hidden=\"true\">↗</span>";
      if (text.includes("Customer pilot")) link.textContent = "Customer demo";
    });
    const heroActions = document.querySelector(".hero .actions");
    if (heroActions && !heroActions.querySelector("a")) heroActions.remove();
    document.querySelectorAll(".navlinks a[href='#how'], .hero a[href='#how']").forEach(link => { link.href = "#how"; });
    const faq = Array.from(document.querySelectorAll("details")).find(item => item.textContent.includes("Can I see the customer experience?"));
    if (faq) {
      faq.querySelector("p").textContent = "Yes. Open a visual-only customer journey to see how the branded tap-and-scan experience feels. Nothing entered there is sent or stored.";
    }
    const cta = document.querySelector(".cta");
    if (cta) {
      const copy = cta.querySelector("p");
      if (copy) copy.textContent = "Explore the customer journey in a safe, visual-only demo.";
    }
  }

  if (location.pathname === "/demo" || location.pathname === "/demo/") renderDemo();
  else if (!location.pathname.startsWith("/village-barbers-cobham") && !location.pathname.startsWith("/t/JB001")) updateMarketingLinks();
})();
