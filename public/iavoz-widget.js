/* IAVoz · Sara (agente de voz) para Kuentas.
   Cargado en todas las páginas desde app/layout.tsx (<script src="/iavoz-widget.js" defer>).
   Botón de WhatsApp retirado el 24-oct-2026 por orden de Iván: el contacto es solo por email.
   8-nov-2026: el botón de Sara va abajo a la izquierda y en el móvil tapaba «Solo esenciales» del aviso de
   cookies (components/CookieConsent.tsx). Se carga cuando ya hay una decisión de cookies guardada. */
(function () {
  var VOICE_SERVER = 'https://iescudero.pythonanywhere.com';
  var TENANT = 'kuentas';
  var CLAVE_COOKIES = 'kuentas_cookie_consent'; // la misma que components/CookieConsent.tsx

  function hayDecision() {
    // Sin localStorage el aviso de cookies no se muestra, así que no hay nada que tapar.
    try { return !!window.localStorage.getItem(CLAVE_COOKIES); } catch (e) { return true; }
  }

  // Agente de voz Sara
  function cargar() {
    try {
      var s = document.createElement('script');
      s.src = VOICE_SERVER.replace(/\/+$/, '') + '/widget/' + TENANT + '/loader.js';
      s.async = true; s.defer = true;
      (document.body || document.documentElement).appendChild(s);
    } catch (e) {}
  }

  if (hayDecision()) { cargar(); return; }
  var espera = setInterval(function () {
    if (hayDecision()) { clearInterval(espera); cargar(); }
  }, 1000);
})();
