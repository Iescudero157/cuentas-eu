/* IAVoz · Sara (agente de voz) para Kuentas.
   Cargado en todas las páginas desde app/layout.tsx (<script src="/iavoz-widget.js" defer>).
   Botón de WhatsApp retirado el 24-oct-2026 por orden de Iván: el contacto es solo por email.
   8-nov-2026: el botón de Sara va abajo a la izquierda y en el móvil tapaba «Solo esenciales» del aviso de
   cookies (components/CookieConsent.tsx). Se carga cuando ya hay una decisión de cookies guardada.
   26-nov-2026 (Iván): abajo a la izquierda tapaba «Cerrar sesión» del menú lateral del panel. En la app va
   abajo a la DERECHA. Solo aquí: la web kuentas.eu y la configuración del servidor (bottom-left) no cambian. */
(function () {
  var VOICE_SERVER = 'https://iescudero.pythonanywhere.com';
  var TENANT = 'kuentas';
  var CLAVE_COOKIES = 'kuentas_cookie_consent'; // la misma que components/CookieConsent.tsx

  try {
    var estilo = document.createElement('style');
    estilo.setAttribute('data-kuentas-sara', 'derecha');
    estilo.textContent = '.va-trigger.va-bottom-left{left:auto !important;right:20px !important;}';
    (document.head || document.documentElement).appendChild(estilo);
  } catch (e) {}

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
