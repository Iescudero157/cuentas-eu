import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terminos de Servicio - KUENTAS.EU",
  description: "Terminos y condiciones de uso de la plataforma KUENTAS.EU",
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

        <h1 className="text-3xl font-bold text-brand-text mb-2">Terminos de Servicio</h1>
        <p className="text-brand-muted mb-8">Ultima actualizacion: 15 de mayo de 2026</p>

        <div className="prose prose-sm max-w-none text-brand-text space-y-6">
          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">1. Aceptacion de los terminos</h2>
            <p className="text-brand-muted leading-relaxed">
              Al acceder y utilizar KUENTAS.EU (&quot;la Plataforma&quot;), operada por MercadonetGlobal (&quot;la Empresa&quot;),
              aceptas quedar vinculado por estos Terminos de Servicio. Si no estas de acuerdo con alguno de estos terminos,
              no debes utilizar la Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">2. Descripcion del servicio</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU es una plataforma de gestion financiera con inteligencia artificial dirigida a autonomos,
              freelancers y creadores de contenido en Espana. El servicio incluye gestion de ingresos y gastos,
              estimacion de impuestos, facturacion, y herramientas de cash flow.
            </p>
            <p className="text-brand-muted leading-relaxed mt-2">
              <strong className="text-brand-text">Importante:</strong> KUENTAS.EU no es una gestoria ni sustituye
              el asesoramiento fiscal profesional. Las estimaciones de impuestos son orientativas y no constituyen
              declaraciones fiscales vinculantes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">3. Registro y cuenta de usuario</h2>
            <p className="text-brand-muted leading-relaxed">
              Para utilizar el servicio debes crear una cuenta proporcionando informacion veraz y actualizada.
              Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las
              actividades que se realicen bajo tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">4. Planes y facturacion</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU ofrece planes gratuitos y de pago. Los planes de pago se facturan mensualmente y
              pueden cancelarse en cualquier momento. La cancelacion surte efecto al final del periodo de
              facturacion en curso. No se realizan reembolsos por periodos parciales.
            </p>
            <p className="text-brand-muted leading-relaxed mt-2">
              Los pagos se procesan de forma segura a traves de Stripe. KUENTAS.EU no almacena datos
              de tarjetas de credito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">5. Proteccion de datos</h2>
            <p className="text-brand-muted leading-relaxed">
              Tratamos tus datos personales de acuerdo con el Reglamento General de Proteccion de Datos (RGPD)
              y la Ley Organica 3/2018 de Proteccion de Datos. Consulta nuestra{" "}
              <Link href="/privacidad" className="text-brand-blue hover:underline">Politica de Privacidad</Link> para
              mas detalles sobre como recopilamos, usamos y protegemos tu informacion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">6. Conexion bancaria</h2>
            <p className="text-brand-muted leading-relaxed">
              La conexion bancaria utiliza Open Banking bajo la normativa PSD2 regulada por el Banco de Espana.
              El acceso es de solo lectura: podemos consultar movimientos pero nunca realizar operaciones ni mover fondos.
              Las credenciales bancarias nunca se almacenan en nuestros servidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">7. Limitacion de responsabilidad</h2>
            <p className="text-brand-muted leading-relaxed">
              KUENTAS.EU proporciona herramientas orientativas de gestion financiera. No nos hacemos responsables
              de decisiones fiscales tomadas exclusivamente en base a las estimaciones de la plataforma.
              Recomendamos consultar con un asesor fiscal cualificado para decisiones fiscales importantes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">8. Propiedad intelectual</h2>
            <p className="text-brand-muted leading-relaxed">
              Todo el contenido, diseno, codigo y materiales de KUENTAS.EU son propiedad de MercadonetGlobal.
              Tus datos financieros son y seran siempre tuyos. Puedes exportarlos en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">9. Cancelacion y portabilidad</h2>
            <p className="text-brand-muted leading-relaxed">
              Puedes cancelar tu cuenta en cualquier momento desde los ajustes. Al cancelar, tienes 30 dias
              para exportar todos tus datos en formato CSV o PDF. Transcurrido ese plazo, eliminaremos tus
              datos personales de nuestros sistemas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">10. Legislacion aplicable</h2>
            <p className="text-brand-muted leading-relaxed">
              Estos terminos se rigen por la legislacion espanola. Para cualquier controversia, ambas partes
              se someten a los juzgados y tribunales de Madrid, salvo lo dispuesto por la normativa de consumidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">11. Contacto</h2>
            <p className="text-brand-muted leading-relaxed">
              Para cualquier cuestion sobre estos terminos, contacta con nosotros en{" "}
              <a href="mailto:hola@kuentas.eu" className="text-brand-blue hover:underline">hola@kuentas.eu</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
