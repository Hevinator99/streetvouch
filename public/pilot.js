(function () {
  if (!location.pathname.startsWith('/village-barbers-cobham') && !location.pathname.startsWith('/t/JB001')) return;
  const business = 'village-barbers-cobham';
  const reviewUrl = 'https://www.google.com/search?q=Village+Barbers+Cobham#lrd=0x4875df983e87e645:0xff91360ffce80202,3,,,,';
  const poweredLive = '<div class="powered">Feedback made simple with <a class="brand" href="/"><span class="mark" aria-hidden="true">✓</span>streetvouch</a> · <a href="/privacy">Privacy</a></div>';
  let session = sessionStorage.getItem('sv_session');
  if (!session) { session = crypto.randomUUID(); sessionStorage.setItem('sv_session', session); }
  const track = event => fetch('/api/track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event, business, session }), keepalive: true }).catch(() => {});
  track('page_view');

  window.choices = function choicesLive() {
    const el = document.getElementById('journey');
    el.innerHTML = `<img class="barber-logo" src="/village-barbers-logo.jpeg" alt="Village Barbers Cobham logo"><div class="shop-name">Village Barbers Cobham</div><h2>Enjoyed your visit?</h2><p class="barber-intro">A quick Google review helps more local people find us.</p><button class="choice choice-primary" id="google"><span class="google-mark" aria-hidden="true"><span>G</span></span><span><b>Leave a Google review</b><small>Usually takes less than a minute</small></span><span class="arrow" aria-hidden="true">↗</span></button><div class="private-route"><span>Something we should know?</span><button id="private">Send private feedback</button></div><p class="honesty-note">All honest feedback is welcome.</p>${poweredLive}`;
    document.getElementById('google').onclick = () => { track('google_click'); setTimeout(() => location.assign(reviewUrl), 90); };
    document.getElementById('private').onclick = window.feedback;
  };

  window.feedback = function feedbackLive() {
    document.getElementById('journey').innerHTML = `<button class="back-btn" id="back">← Back to your options</button><div class="eyebrow">A note for the team</div><h2>We’re listening.</h2><p class="barber-intro">Tell us what worked, what didn’t, or what would make your next visit better.</p><form class="feedback-form" id="feedback"><label for="message">Your feedback</label><textarea id="message" name="message" required minlength="3" maxlength="2000" placeholder="Tell us about your experience…"></textarea><div class="field-meta"><span id="count">0</span> / 2,000</div><label for="name">Your name <span class="micro">Optional</span></label><input id="name" name="name" type="text" maxlength="100" placeholder="First name" autocomplete="given-name"><label class="consent"><input id="contact" type="checkbox"><span>I’d like the team to get back to me.</span></label><div id="email-field" hidden><label for="email">Email address</label><input id="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com"><small class="micro">Used only to respond to this feedback.</small></div><div class="trap" aria-hidden="true"><label for="website">Website</label><input id="website" tabindex="-1" autocomplete="off"></div><button class="btn form-submit" type="submit">Send private feedback <span aria-hidden="true">→</span></button><p class="form-status" id="form-status" role="status"></p><details class="privacy-details"><summary>How we use your information</summary><p>Your message is received by Village Barbers Cobham and processed securely by StreetVouch so the team can review and respond. Your name is optional. Your email is collected only if you request a reply. Pilot records are retained for up to 12 months, then deleted. You can ask the shop to have your feedback deleted.</p></details></form>${poweredLive}`;
    document.getElementById('back').onclick = window.choices;
    document.getElementById('message').oninput = e => document.getElementById('count').textContent = e.target.value.length;
    document.getElementById('contact').onchange = e => { document.getElementById('email-field').hidden = !e.target.checked; document.getElementById('email').required = e.target.checked; };
    document.getElementById('feedback').onsubmit = async e => {
      e.preventDefault(); const form = e.currentTarget, button = form.querySelector('[type=submit]'), status = document.getElementById('form-status');
      button.disabled = true; button.textContent = 'Sending…'; status.textContent = '';
      try {
        const response = await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ business, session, message:document.getElementById('message').value, name:document.getElementById('name').value, contactRequested:document.getElementById('contact').checked, email:document.getElementById('email').value, website:document.getElementById('website').value }) });
        const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to send feedback.');
        document.getElementById('journey').innerHTML = `<div class="success-icon" aria-hidden="true">✓</div><div class="eyebrow">Feedback sent</div><h2>Thank you.</h2><p class="barber-intro">Your private feedback is now securely with the Village Barbers Cobham team.</p><button class="btn form-submit" id="again">Back to the start</button>${poweredLive}`;
        document.getElementById('again').onclick = window.choices;
      } catch (error) { status.textContent = error.message || 'We couldn’t send your feedback. Please try again.'; button.disabled = false; button.textContent = 'Send private feedback →'; }
    };
  };
  window.choices();
})();
