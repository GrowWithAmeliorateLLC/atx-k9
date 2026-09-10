/* ATX K9 inquiry form.
   Sends the form to /api/lead (a Netlify function that talks to GoHighLevel
   server-side), then reveals the GHL booking calendar. No API keys in the browser. */
(function(){
  var CALENDAR_URL = 'https://api.leadconnectorhq.com/widget/bookings/atx-k9-consult';
  var form = document.getElementById('intakeForm');
  if (!form) return;

  function val(name){ var el = form.elements[name]; return el && el.value ? el.value.trim() : ''; }
  function checked(name){ var el = form.elements[name]; return !!(el && el.checked); }
  function splitName(n){ n = (n || '').trim(); var i = n.indexOf(' '); return i === -1 ? {f:n, l:''} : {f:n.slice(0,i), l:n.slice(i+1)}; }

  function submitLead(){
    return fetch('/api/lead', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: val('name'), phone: val('phone'), email: val('email'),
        dog: val('dog'), age: val('age'), breed: val('breed'),
        program: val('program'), message: val('message'), referral: val('referral'),
        dates: val('dates'),
        sms_transactional: checked('sms_transactional'),
        sms_marketing: checked('sms_marketing')
      })
    }).then(function(res){
      if (!res.ok) { return res.text().then(function(t){ throw new Error('Lead ' + res.status + ': ' + t); }); }
      return res.json().catch(function(){ return null; });
    });
  }

  function reveal(){
    var nm = splitName(val('name'));
    var params = new URLSearchParams({
      first_name: nm.f, last_name: nm.l, firstname: nm.f, lastname: nm.l,
      email: val('email'), phone: val('phone'), full_name: (nm.f + ' ' + nm.l).trim(),
      notes: val('dog') ? ('Dog: ' + val('dog') + (val('program') ? (' · ' + val('program')) : '')) : ''
    });
    var cn = document.getElementById('calName'); if (cn) cn.textContent = nm.f || 'friend';
    document.getElementById('intakeStep').style.display = 'none';
    var cal = document.getElementById('calStep'); cal.style.display = 'block';
    var sc = form.closest('.start-card'); if (sc) sc.classList.add('cal-active');
    var em = document.getElementById('calEmbed');
    if (em) {
      em.style.border = 'none'; em.style.padding = '0'; em.style.background = 'transparent'; em.style.minHeight = '0';
      em.innerHTML = '<iframe class="cal-frame" src="' + CALENDAR_URL + '?' + params.toString() + '" title="Pick a consultation time" loading="lazy"></iframe>';
    }
    (sc || cal).scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]'); var orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    submitLead()
      .then(function(){
        if (window.fbq) fbq('track', 'Lead');
        if (window.gtag) gtag('event', 'conversion', {'send_to': 'AW-950084892/Zz6ICOf9we4cEJzKhMUD', 'value': 1.0, 'currency': 'USD'});
      })
      .catch(function(err){ console.error('ATX K9 lead submit failed:', err); })
      .then(function(){ if (btn) { btn.disabled = false; btn.textContent = orig; } reveal(); });
  });

  window.addEventListener('message', function(ev){
    if (ev.origin && ev.origin.indexOf('leadconnectorhq.com') === -1) return;
    var d = ev.data; if (!d) return;
    var n = (typeof d === 'string' ? d : (d.event || d.type || '')) + '';
    if (/book|appointment|scheduled|confirmed|success/i.test(n)) {
      window.dataLayer = window.dataLayer || []; window.dataLayer.push({event: 'consult_booked'});
      if (window.fbq) fbq('track', 'Schedule');
    }
  });
})();
