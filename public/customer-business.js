(function(){
  const root=document.querySelector('[data-business]');
  const configNode=document.getElementById('customer-config');
  if(!root||!configNode)return;
  const config=JSON.parse(configNode.textContent);
  const query=new URLSearchParams(location.search);
  const asset=query.get('asset')||config.asset||'';
  const entryChannel=query.get('channel')||config.entryChannel||'';
  const journey=document.getElementById('customer-journey');
  const anonymousNote=document.createElement('p');
  anonymousNote.className='anonymous-note';
  anonymousNote.textContent='Private feedback can be sent anonymously.';
  document.querySelector('.private-route').after(anonymousNote);

  const refreshConfig=()=>fetch(`/api/customer/config/${encodeURIComponent(config.slug)}`)
    .then(response=>response.ok?response.json():null)
    .then(latest=>{
      if(!latest)return;
      config.googleReviewUrl=latest.google_review_url;
      document.querySelector('.shop-name').textContent=latest.name;
      document.querySelector('.customer-business-card>small').textContent=latest.category||'Local business';
      document.querySelector('.customer-business-card>h1').textContent=latest.customer_heading;
      document.querySelector('.customer-business-card>p').textContent=latest.customer_intro;
      document.querySelector('.private-route>span').textContent=latest.customer_private_prompt;
      const logo=document.querySelector('.customer-logo img');
      if(logo&&latest.logo_url)logo.src=latest.logo_url;
    }).catch(()=>{});
  if('requestIdleCallback'in window)requestIdleCallback(refreshConfig,{timeout:1800});
  else setTimeout(refreshConfig,1000);

  const track=event=>{
    const body=JSON.stringify({business:config.slug,event,asset,test:config.test});
    if(navigator.sendBeacon&&navigator.sendBeacon('/api/customer/track',new Blob([body],{type:'application/json'})))return;
    fetch('/api/customer/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  };
  if(entryChannel==='nfc')track('nfc_tap');
  else if(entryChannel==='qr')track('qr_scan');
  track('page_view');

  document.getElementById('customer-google').onclick=()=>{
    if(config.test){
      journey.innerHTML='<div class="safe-test-result"><b>Google review test passed.</b><p>No Google page was opened and no review can be published in safe test mode.</p><button class="btn" onclick="location.reload()">Back</button></div>';
      return;
    }
    track('google_click');
    location.assign(config.googleReviewUrl);
  };

  document.getElementById('customer-private').onclick=()=>{
    journey.innerHTML=`<form class="customer-feedback-form" id="customer-feedback">
      <label>Your feedback<textarea id="customer-message" required minlength="3" maxlength="2000"></textarea></label>
      <label class="anonymous-choice"><input id="customer-anonymous" type="checkbox" checked><span><b>Send anonymously</b><small>No name or email is attached, so the team cannot reply. Avoid identifying details in your message.</small></span></label>
      <div class="customer-identity" id="customer-identity" hidden>
        <label>Your name <small>Optional</small><input id="customer-name" maxlength="100"></label>
        <label class="consent"><input id="customer-contact" type="checkbox"><span>I would like the team to reply.</span></label>
        <label id="customer-email-wrap" hidden>Email address<input id="customer-email" type="email"><small>Only used to reply to your feedback.</small></label>
      </div>
      <button class="btn">${config.test?'Run safe feedback test':'Send anonymous feedback'}</button>
      <p id="customer-status" role="status"></p>
    </form>`;
    const form=document.getElementById('customer-feedback');
    const anonymous=document.getElementById('customer-anonymous');
    const identity=document.getElementById('customer-identity');
    const contact=document.getElementById('customer-contact');
    const email=document.getElementById('customer-email');
    const emailWrap=document.getElementById('customer-email-wrap');
    const name=document.getElementById('customer-name');
    const button=form.querySelector('button');
    anonymous.onchange=()=>{
      identity.hidden=anonymous.checked;
      if(anonymous.checked){name.value='';contact.checked=false;email.value='';email.required=false;emailWrap.hidden=true;}
      if(!config.test)button.textContent=anonymous.checked?'Send anonymous feedback':'Send private feedback';
    };
    contact.onchange=()=>{emailWrap.hidden=!contact.checked;email.required=contact.checked;if(!contact.checked)email.value='';};
    form.onsubmit=async event=>{
      event.preventDefault();
      const status=document.getElementById('customer-status');
      const originalLabel=button.textContent;
      button.disabled=true;
      button.classList.add('is-sending');
      button.setAttribute('aria-busy','true');
      button.innerHTML='<span class="send-spinner" aria-hidden="true"></span><span>Sending securely…</span>';
      status.textContent='Your feedback is being sent securely.';
      try{
        const response=await fetch('/api/customer/feedback',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({business:config.slug,asset,test:config.test,message:document.getElementById('customer-message').value,anonymous:anonymous.checked,name:anonymous.checked?'':name.value,contactRequested:!anonymous.checked&&contact.checked,email:!anonymous.checked&&contact.checked?email.value:''})
        });
        const result=await response.json();
        if(!response.ok)throw new Error(result.message||'Could not send feedback.');
        journey.innerHTML=`<div class="safe-test-result"><b>${config.test?'Safe test passed':'Thank you'}</b><p>${result.message}</p></div>`;
      }catch(error){
        status.textContent=error.message||'Could not send feedback. Please try again.';
        button.disabled=false;
        button.classList.remove('is-sending');
        button.removeAttribute('aria-busy');
        button.textContent=originalLabel;
      }
    };
  };
})();
