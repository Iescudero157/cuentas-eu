/* IAVoz · Sara (agente de voz) para Kuentas.
   Cargado en todas las páginas desde app/layout.tsx (<script src="/iavoz-widget.js" defer>).
   Botón de WhatsApp retirado el 24-oct-2026 por orden de Iván: el contacto es solo por email. */
(function () {
  var VOICE_SERVER = 'https://iescudero.pythonanywhere.com';
  var TENANT = 'kuentas';

  // Agente de voz Sara
  try {
    var s = document.createElement('script');
    s.src = VOICE_SERVER.replace(/\/+$/, '') + '/widget/' + TENANT + '/loader.js';
    s.async = true; s.defer = true;
    (document.body || document.documentElement).appendChild(s);
  } catch (e) {}
})();
