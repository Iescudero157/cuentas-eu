// Genera la página estática de la declaración responsable para kuentas.eu
// (verifactu.html) desde la fuente única lib/verifactu/declaracion-responsable.ts,
// para que la web publique exactamente el mismo texto que la app (art. 15.1
// Orden HAC/1177/2024). Uso:
//   node scripts/verifactu-declaracion-web.mjs <ruta/verifactu.html>
// Sin argumento escribe el texto plano por la salida estándar.

import { writeFileSync } from 'node:fs'

import {
  declaracionResponsableKuentas,
  textoDeclaracionResponsable,
} from '../lib/verifactu/declaracion-responsable.ts'

const d = declaracionResponsableKuentas()
const destino = process.argv[2]

if (!destino) {
  process.stdout.write(textoDeclaracionResponsable(d) + '\n')
  process.exit(0)
}
if (d.esBorrador) {
  console.error('La declaración sigue en borrador: no se genera la página pública.')
  process.exit(1)
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const apartados = d.apartados
  .map(
    (ap) =>
      `<h2>${esc(ap.letra)}) ${esc(ap.titulo)}</h2>\n` +
      ap.parrafos.map((p) => `<p>${esc(p)}</p>`).join('\n')
  )
  .join('\n\n')

const titulo = `Declaración responsable Verifactu de ${d.sistema.nombre} ${d.sistema.version} - KUENTAS`
const descripcion =
  `Declaración responsable del sistema informático de facturación ${d.sistema.nombre}, ` +
  `versión ${d.sistema.version}, suscrita por ${d.productor.razonSocial} ` +
  '(art. 13 RD 1007/2023 y art. 15 Orden HAC/1177/2024).'

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<!-- Generada con cuentas-app/scripts/verifactu-declaracion-web.mjs desde
     lib/verifactu/declaracion-responsable.ts: no editar a mano. -->
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://kuentas.eu/verifactu.html">
<link rel="icon" type="image/png" sizes="32x32" href="https://res.cloudinary.com/dyzzzlbfu/image/upload/v1775820232/Favic%C3%B3n_Kuentas_transparente_lnyh45.png">
<style>
body{font-family:'Segoe UI',system-ui,-apple-system,Roboto,sans-serif;color:#1f2937;line-height:1.7;font-size:17px;background:#fff;margin:0}
main{max-width:760px;margin:0 auto;padding:40px 20px 64px}
a{color:#2A5AAE}
h1{font-size:1.6em;line-height:1.3;margin:24px 0 8px;color:#111827}
h2{font-size:1.15em;margin:32px 0 10px;color:#111827}
.sub{color:#4b5563;margin:0 0 20px}
.acciones a{display:inline-block;margin:0 12px 8px 0;padding:10px 16px;border-radius:8px;background:#2A5AAE;color:#fff;text-decoration:none;font-weight:600}
.acciones a.sec{background:#eef2fb;color:#1E4A8E}
footer{margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:14px;color:#6b7280}
</style>
</head>
<body>
<main>
<p><a href="/">← kuentas.eu</a></p>
<h1>${esc(d.titulo)}</h1>
<p class="sub">${esc(d.sistema.nombre)} · versión ${esc(d.sistema.version)} · ${esc(d.productor.razonSocial)} (NIF ${esc(d.productor.nif)})</p>
<p class="acciones"><a href="https://app.kuentas.eu/api/verifactu/declaracion-responsable">Descargar en PDF</a><a class="sec" href="https://app.kuentas.eu/verifactu">Verla en la app</a></p>

${apartados}

<footer>
<p>Declaración formulada conforme al artículo 13 del Real Decreto 1007/2023, de 5 de diciembre, y al
artículo 15 de la Orden HAC/1177/2024, de 17 de octubre. Los datos identificativos del sistema coinciden
con los que se remiten a la AEAT en cada registro de facturación.</p>
<p>${esc(d.productor.razonSocial)} · NIF ${esc(d.productor.nif)} · ${esc(d.productor.registroMercantil)} ·
${esc(d.productor.domicilio)} · <a href="mailto:kuentas@mercadonet.es">kuentas@mercadonet.es</a></p>
</footer>
</main>
</body>
</html>
`

writeFileSync(destino, html, 'utf8')
console.log(`Escrita ${destino} (${html.length} caracteres)`)
