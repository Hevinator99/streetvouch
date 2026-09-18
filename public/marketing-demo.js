(function () {
  const liveClientPath = "/village-barbers-cobham/";
  const app = document.getElementById("app");
  if (!app) return;

  function showDemoNotice() {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.innerHTML = "<h2>Sample interaction</h2><p>This is a visual preview only. Nothing has been opened, sent or stored.</p><button class=\"btn\">Back to the sample</button>";
    dialog.querySelector("button").onclick = () => dialog.close();
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  function sampleChoices() {
    const journey = document.getElementById("sample-journey");
    if (!journey) return;
    journey.innerHTML = `<div class="shop-name">MOORLAND COFFEE</div><h2>Enjoyed your visit?</h2><p class="barber-intro">A quick review helps more local people find the café.</p><button class="choice choice-primary" type="button" id="sample-review"><span class="google-mark" aria-hidden="true"><span>★</span></span><span><b>Leave a review</b><small>Usually takes less than a minute</small></span><span class="arrow" aria-hidden="true">↗</span></button><div class="private-route"><span>Something we should know?</span><button type="button" id="sample-feedback">Share private feedback</button></div><p class="honesty-note">All honest feedback is welcome.</p><p class="privacy-note">Sample only · no information is sent or stored.</p><div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a></div>`;
    document.getElementById("sample-review").onclick = showDemoNotice;
    document.getElementById("sample-feedback").onclick = sampleFeedback;
  }

  function sampleFeedback() {
    const journey = document.getElementById("sample-journey");
    if (!journey) return;
    journey.innerHTML = `<button class="back-btn" type="button" id="sample-back">← Back to your options</button><div class="eyebrow">A note for the team</div><h2>We’re listening.</h2><p class="barber-intro">Tell us what worked, what didn’t, or what would make your next visit better.</p><form class="feedback-form" id="sample-feedback-form"><label for="sample-message">Your feedback</label><textarea id="sample-message" required minlength="3" maxlength="2000" placeholder="Tell us about your experience…"></textarea><div class="field-meta"><span id="sample-count">0</span> / 2,000</div><label for="sample-name">Your name <span class="micro">Optional</span></label><input id="sample-name" type="text" maxlength="100" placeholder="First name" autocomplete="off"><button class="btn form-submit" type="submit">Preview the journey <span aria-hidden="true">→</span></button><p class="privacy-note">Sample only. Nothing is sent, stored or shared.</p></form><div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a></div>`;
    document.getElementById("sample-back").onclick = sampleChoices;
    const message = document.getElementById("sample-message");
    message.oninput = () => { document.getElementById("sample-count").textContent = message.value.length; };
    document.getElementById("sample-feedback-form").onsubmit = event => {
      event.preventDefault();
      journey.innerHTML = `<div class="success-icon" aria-hidden="true">✓</div><div class="eyebrow">Sample complete</div><h2>That’s all it takes.</h2><p class="barber-intro">This is only a visual example. Nothing has been saved or sent.</p><button class="btn form-submit" type="button" id="sample-again">Try the sample again</button><p class="privacy-note">Fictional business · visual demonstration only.</p>`;
      document.getElementById("sample-again").onclick = sampleChoices;
    };
  }

  function renderSample() {
    document.body.classList.add("barber");
    app.innerHTML = `<div class="demo-banner">Sample customer page · Fictional business · No feedback is sent or stored.</div><main class="barber-layout"><section class="barber-visual" aria-label="Sample coffee shop customer page"><img src="https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1600&q=85" alt="Warm independent coffee shop interior"><div class="barber-overlay"><div class="barber-wordmark">MOORLAND COFFEE · SAMPLE</div><div><h1>Moorland<br>Coffee.</h1><p>Thank you for visiting your local café.</p></div></div></section><section class="barber-panel" id="sample-journey" aria-live="polite"></section></main>`;
    sampleChoices();
  }

  function updateMarketingPage() {
    document.querySelector(".story-section")?.setAttribute("id", "how");
    const laterHow = document.querySelector("section#how:not(.story-section)");
    if (laterHow) laterHow.id = "workflow";
    document.querySelectorAll(`a[href="${liveClientPath}"]`).forEach(link => {
      const text = link.textContent.trim();
      if (text.includes("Try the experience") || text.includes("Explore the barber demo") || text.includes("Open the customer page")) link.remove();
      else if (text.includes("See what your customers see")) {
        link.href = "/demo";
        link.innerHTML = "See a sample customer page <span aria-hidden=\"true\">↗</span>";
      } else if (text.includes("Customer pilot")) {
        link.href = "/demo";
        link.textContent = "Sample customer page";
      } else link.remove();
    });
    document.querySelector(".cta")?.remove();
  }

  if (location.pathname === "/demo" || location.pathname === "/demo/") renderSample();
  else if (!location.pathname.startsWith("/village-barbers-cobham") && !location.pathname.startsWith("/t/JB001")) updateMarketingPage();
})();
