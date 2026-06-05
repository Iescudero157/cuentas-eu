/* IAVoz · Sara (agente de voz) + botón flotante de WhatsApp para Kuentas.
   Cargado en todas las páginas desde app/layout.tsx (<script src="/iavoz-widget.js" defer>). */
(function () {
  var VOICE_SERVER = 'https://iescudero.pythonanywhere.com';
  var TENANT = 'kuentas';
  var WA = '34689999812';
  var WA_TEXT = 'Dime%20lo%20que%20necesitas%20%28Kuentas%29';

  // 1) Agente de voz Sara
  try {
    var s = document.createElement('script');
    s.src = VOICE_SERVER.replace(/\/+$/, '') + '/widget/' + TENANT + '/loader.js';
    s.async = true; s.defer = true;
    (document.body || document.documentElement).appendChild(s);
  } catch (e) {}

  // 2) Botón flotante de WhatsApp
  function addWhatsApp() {
    if (document.getElementById('iavoz-whatsapp-btn')) return;
    var a = document.createElement('a');
    a.id = 'iavoz-whatsapp-btn';
    a.href = 'https://wa.me/' + WA + '?text=' + WA_TEXT;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'WhatsApp');
    a.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:99998;text-decoration:none;';
    a.innerHTML = '<svg viewBox="0 0 24 24" width="32" height="32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20.52 3.48A11.95 11.95 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.18 1.6 6L0 24l6.18-1.62A11.96 11.96 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 21.82a9.83 9.83 0 0 1-5-1.36l-.36-.21-3.67.96.98-3.58-.23-.37A9.83 9.83 0 0 1 2.18 12C2.18 6.58 6.58 2.18 12 2.18S21.82 6.58 21.82 12 17.42 21.82 12 21.82zm5.5-7.36c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.36.22-.66.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.65-.94-2.26-.25-.6-.5-.52-.68-.53-.18-.01-.38-.01-.58-.01-.2 0-.53.07-.81.38-.28.3-1.06 1.04-1.06 2.54s1.09 2.95 1.24 3.15c.15.2 2.15 3.28 5.21 4.6.73.31 1.3.5 1.74.64.73.23 1.4.2 1.93.12.59-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.07-.13-.27-.2-.57-.35z"/></svg>';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addWhatsApp);
  else addWhatsApp();
})();
