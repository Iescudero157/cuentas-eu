# V23 — App Android de Kuentas y Verifactu

Fecha: 2026-09-22 · Ítem: V23 (QR tributario + leyenda en las facturas que la app
Android muestre o genere).

## 1. Cómo está hecha la app de Google Play

La app **no tiene repo git propio**. Vive en
`D:/Claude IvanEscudero/Kuentas/mobile_app/capacitor_app` (fuera de este repo) y es un
**wrapper Capacitor 8 puro** sobre la web de producción:

- `capacitor.config.ts`: `appId eu.kuentas.app`, `server.url = https://app.kuentas.eu`
  (`cleartext: false`, `allowMixedContent: false`). El WebView carga la web **en vivo**;
  no hay bundle web local (el `www/index.html` es solo un fallback con meta-refresh a
  `app.kuentas.eu`).
- `MainActivity.java` era la plantilla vacía de Capacitor (`extends BridgeActivity {}`).
- Sin plugins Capacitor adicionales (solo `@capacitor/android|cli|core` 8.2.0).
- Versionado encontrado: `build.gradle` estaba en `versionCode 5 / versionName 1.1.2`
  (build del 28-ago-2026 en `android/app/build/outputs/bundle/release/`); en
  `mobile_app/release/` hay AAB hasta `Kuentas_v1.1.1.aab`. Firma con
  `mobile_app/kuentas-release.keystore` (config en `android/app/build.gradle`).

## 2. QR + leyenda: garantía arquitectónica

Como la app renderiza `app.kuentas.eu` en vivo, **muestra exactamente lo que sirva
producción**, sin necesidad de actualizar la app en Play:

- El PDF de factura es de **fuente única de servidor** (`GET /api/invoices/[id]/pdf`,
  D-08/V08): para facturas emitidas bajo Verifactu incluye el **QR tributario** y la
  leyenda **«Factura verificable en la sede electrónica de la AEAT» / VERI*FACTU**
  (arts. 20-21 Orden HAC/1177/2024) generados en servidor. La app no genera facturas
  por su cuenta: no hay ninguna ruta de emisión ni plantilla de PDF dentro del APK.
- La demo (localStorage) usa plantilla cliente **sin QR ni leyenda** a propósito
  (D-11: la demo no simula elementos tributarios); aplica igual en la app.
- El panel Verifactu, la ayuda y la declaración responsable (`/verifactu`, art. 13.2
  RRSIF) son páginas de la misma web y quedan visibles desde la app.

Conclusión: **cuando la rama `verifactu` se despliegue a producción (decisión de Iván),
la app Android mostrará el QR + leyenda automáticamente**, sin rebuild.

## 3. Problema real detectado: descargas rotas en el WebView

Un WebView Android **sin `DownloadListener` ignora en silencio** cualquier descarga.
Toda descarga de la web es `fetch → blob → <a download>.click()` o `PDFDownloadLink`
(también blob): PDF de factura (¡el que lleva el QR!), CSV de facturas/gastos/ingresos,
export de conservación (ZIP, V16), export ClassicConta (V22) y declaración responsable.
En la app publicada el botón «Descargar PDF» termina sin error y **sin fichero**: el
usuario de la app no podía obtener la factura con QR.

### Fix aplicado (en `mobile_app/capacitor_app`, pendiente de publicar)

1. **`MainActivity.java` reescrita**: `DownloadListener` en el WebView del bridge.
   - URLs `blob:` → JS inyectado (`evaluateJavascript`) lee el blob (XHR + FileReader)
     y lo entrega en base64 al puente nativo `KuentasDownloader.recibirBase64`
     (`@JavascriptInterface` añadido en `onCreate`).
   - Guardado en **Descargas** vía `MediaStore.Downloads` (API ≥29) o en el directorio
     externo de la app + `FileProvider` (API 24-28, sin permisos nuevos), con Toast
     «Guardado en Descargas: …» e intent `ACTION_VIEW` para abrir el PDF.
   - URLs `http(s)` con `Content-Disposition` → `DownloadManager` clásico con cookies
     (red de seguridad para futuros enlaces directos).
2. **`res/xml/file_paths.xml`**: añadida `<external-files-path name="descargas"
   path="Download/">` para el FileProvider ya declarado en el manifest.
3. **`build.gradle`**: `versionCode 6 / versionName "1.2.0"`.
4. **`local.properties`**: `sdk.dir` apuntaba al SDK de la máquina antigua (ARES,
   `C:/Users/Ivan/...`); actualizado a `C:/Android/sdk` (SDK instalado en ARES2:
   cmdline-tools + platform-36 + build-tools 36.0.0).

Sin permisos nuevos en el manifest (sigue solo `INTERNET`); `targetSdk 36` intacto.

## 4. Publicación (solo Iván)

El fix requiere subir un AAB nuevo a Google Play Console:

1. `cd "D:\Claude IvanEscudero\Kuentas\mobile_app\capacitor_app\android"`
2. `.\gradlew.bat bundleRelease` (firma automática con `kuentas-release.keystore`).
3. AAB en `app\build\outputs\bundle\release\app-release.aab` (copia en
   `mobile_app\release\Kuentas_v1.2.0.aab` si el build de esta sesión terminó verde).
4. Play Console → KUENTAS.EU → Producción → Nueva versión → subir AAB 1.2.0 →
   notas: «Descarga de facturas PDF (QR Verifactu), CSV y exports desde la app».
5. Publicar tras la revisión de Google (horas-días).

**Importante**: la publicación en Play NO bloquea el cumplimiento Verifactu del QR
(§2, llega vía web); solo desbloquea la descarga in-app.

## 5. Notas de seguridad / mantenimiento (para V24 o backlog)

- `mobile_app/` está **fuera de git**: sin control de versiones ni backup de código
  nativo más allá del NAS/Drive. Recomendado: repo propio o subcarpeta versionada.
- Contraseñas del keystore **en claro** en `android/app/build.gradle` (`kuentas2026`).
  Al no estar en git el riesgo es local, pero si se versiona hay que moverlas a
  `keystore.properties`/variables de entorno ANTES del primer commit.
- El `www/index.html` de fallback es una página generada por el generador SEO del blog
  (con GA4 y metas de artículo); inofensiva (solo se ve sin red en el primer arranque),
  pero convendría sustituirla por una página offline limpia.
