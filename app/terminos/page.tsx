import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Términos de Servicio - KUENTAS.EU",
  description: "Términos y condiciones de uso de la plataforma KUENTAS.EU, de MILBROTES, S.L.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-brand-text mb-2">Términos de Servicio</h1>
        <p className="text-brand-muted mb-8">Última actualización: 1 de noviembre de 2026</p>

        <div className="prose prose-sm max-w-none text-brand-text space-y-6">
          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">1. Aceptación de los términos</h2>
            <p className="text-brand-muted leading-relaxed">
              Al acceder y utilizar KUENTAS.EU (&quot;la Plataforma&quot;), operada por MILBROTES, S.L.
              (&quot;la Empresa&quot;; NIF B05772710; Calle Belalcázar, 14, 28006 Madrid; inscrita en el
              Registro Mercantil de Madrid, hoja M-899621, inscripción 1.ª), aceptas quedar vinculado por
              estos Términos de Servicio. Si no estás de acuerdo con alguno de ellos, no debes utilizar la
              Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">2. Descripción del servicio</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU es una plataforma de gestión financiera con inteligencia artificial dirigida a autónomos,
              freelancers y creadores de contenido en España. El servicio incluye gestión de ingresos y gastos,
              estimación de impuestos, facturación y herramientas de cash flow.
            </p>
            <p className="text-brand-muted leading-relaxed mt-2">
              <strong className="text-brand-text">Importante:</strong> KUENTAS.EU no es una gestoría ni sustituye
              el asesoramiento fiscal profesional. Las estimaciones de impuestos son orientativas y no constituyen
              declaraciones fiscales vinculantes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">3. Facturación con Verifactu</h2>
            <p className="text-brand-muted leading-relaxed">
              La Plataforma incluye un módulo de facturación en la modalidad «VERI*FACTU» (Real Decreto
              1007/2023 y Orden HAC/1177/2024), que activamos a petición del usuario. Con el módulo activo,
              cada factura que emites genera su registro de facturación con huella encadenada y código QR,
              y ese registro se remite a la Agencia Tributaria. Tú sigues siendo el obligado tributario
              que expide las facturas; la remisión se hace con el certificado electrónico que subes en
              Ajustes. Las facturas emitidas no se pueden borrar: se corrigen con una factura
              rectificativa o con la anulación de su registro.
            </p>
            <p className="text-brand-muted leading-relaxed mt-2">
              La declaración responsable del sistema, suscrita por MILBROTES, S.L. como productor, está
              disponible en{" "}
              <Link href="/verifactu" className="text-brand-blue hover:underline">app.kuentas.eu/verifactu</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">4. Registro y cuenta de usuario</h2>
            <p className="text-brand-muted leading-relaxed">
              Para utilizar el servicio debes crear una cuenta proporcionando información veraz y actualizada.
              Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las
              actividades que se realicen bajo tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">5. Planes y facturación</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU ofrece planes gratuitos y de pago. Los planes de pago se facturan mensualmente y
              pueden cancelarse en cualquier momento. La cancelación surte efecto al final del periodo de
              facturación en curso. No se realizan reembolsos por periodos parciales.
            </p>
            <p className="text-brand-muted leading-relaxed mt-2">
              Los pagos se procesan a través del TPV Virtual de BBVA (Redsys). KUENTAS.EU no almacena
              datos de tarjetas. Hasta que MILBROTES, S.L. active sus propias cuentas de cobro, los cobros
              y las facturas de los planes de pago los emite MERCADONET GLOBAL S.L. (NIF B98407901).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">6. Protección de datos</h2>
            <p className="text-brand-muted leading-relaxed">
              Tratamos tus datos personales de acuerdo con el Reglamento General de Protección de Datos (RGPD)
              y la Ley Orgánica 3/2018 de Protección de Datos. Consulta nuestra{" "}
              <Link href="/privacidad" className="text-brand-blue hover:underline">Política de Privacidad</Link> para
              más detalles sobre cómo recopilamos, usamos y protegemos tu información.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">7. Movimientos bancarios</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU no se conecta a tu banco ni solicita ni almacena credenciales bancarias. Los movimientos
              se incorporan a la Plataforma mediante la importación de ficheros CSV que el usuario descarga de su
              entidad, el escaneo de tickets y facturas o el registro manual. La Plataforma no realiza operaciones
              ni mueve fondos en ningún caso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">8. Limitación de responsabilidad</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU proporciona herramientas orientativas de gestión financiera. No nos hacemos responsables
              de decisiones fiscales tomadas exclusivamente en base a las estimaciones de la Plataforma.
              Recomendamos consultar con un asesor fiscal cualificado para las decisiones fiscales importantes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">9. Propiedad intelectual</h2>
            <p className="text-brand-muted leading-relaxed">
              Todo el contenido, diseño, código y materiales de KUENTAS.EU son propiedad de MILBROTES, S.L.
              Tus datos financieros son y serán siempre tuyos. Puedes exportarlos en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">10. Cancelación y portabilidad</h2>
            <p className="text-brand-muted leading-relaxed">
              Puedes cancelar tu cuenta en cualquier momento desde los ajustes. Al cancelar, tienes 30 días
              para exportar todos tus datos en formato CSV o PDF. Transcurrido ese plazo, eliminaremos tus
              datos personales de nuestros sistemas, salvo los registros de facturación del módulo
              Verifactu, sus envíos a la AEAT y sus respuestas, que se conservan al menos seis años desde
              la expedición de cada factura porque lo exige la normativa tributaria y mercantil. Antes de
              la baja puedes descargarlos desde el panel Verifactu.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">11. Legislación aplicable</h2>
            <p className="text-brand-muted leading-relaxed">
              Estos términos se rigen por la legislación española. Para cualquier controversia, ambas partes
              se someten a los juzgados y tribunales de Madrid, salvo lo dispuesto por la normativa de consumidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">12. Contacto</h2>
            <p className="text-brand-muted leading-relaxed">
              Para cualquier cuestión sobre estos términos, escribe a{" "}
              <a href="mailto:kuentas@mercadonet.es" className="text-brand-blue hover:underline">kuentas@mercadonet.es</a>{" "}
              o a MILBROTES, S.L., Calle Belalcázar, 14, 28006 Madrid.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
