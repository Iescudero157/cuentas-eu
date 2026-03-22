import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Politica de Privacidad - KUENTAS.EU",
  description: "Politica de privacidad de la aplicacion KUENTAS.EU",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-brand-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="KUENTAS.EU" width={28} height={28} />
            <span className="font-bold text-gradient-brand">KUENTAS.EU</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Politica de Privacidad</h1>
        <p className="text-brand-muted mb-8">Ultima actualizacion: 22 de marzo de 2026</p>

        <div className="prose prose-slate max-w-none space-y-6 text-brand-text text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales es <strong>MercadonetGlobal</strong>,
              con domicilio en Espana. Puede contactarnos en{" "}
              <a href="mailto:hola@kuentas.eu" className="text-brand-blue underline">hola@kuentas.eu</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">2. Datos que recopilamos</h2>
            <p>KUENTAS.EU puede recopilar los siguientes datos personales:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Nombre completo y NIF/CIF (para facturacion)</li>
              <li>Direccion de correo electronico</li>
              <li>Direccion fiscal</li>
              <li>Datos financieros: transacciones bancarias (via Open Banking con su consentimiento explicito), ingresos, gastos y facturas</li>
              <li>Datos de uso de la aplicacion (analytics anonimizados)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">3. Finalidad del tratamiento</h2>
            <p>Sus datos se utilizan exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Prestar el servicio de gestion financiera</li>
              <li>Generar facturas legales</li>
              <li>Estimar obligaciones fiscales (IVA, IRPF)</li>
              <li>Categorizar gastos mediante inteligencia artificial</li>
              <li>Generar predicciones de flujo de caja</li>
              <li>Enviar alertas sobre fechas fiscales</li>
              <li>Mejorar el servicio y la experiencia de usuario</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">4. Base legal</h2>
            <p>
              El tratamiento de datos se basa en el consentimiento del usuario (Art. 6.1.a RGPD),
              la ejecucion de un contrato (Art. 6.1.b RGPD) y el cumplimiento de obligaciones legales
              (Art. 6.1.c RGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">5. Comparticion de datos</h2>
            <p>
              No vendemos, alquilamos ni compartimos sus datos personales con terceros con fines
              comerciales. Sus datos pueden ser procesados por:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Proveedores de infraestructura (Vercel, Supabase) para el alojamiento seguro</li>
              <li>Proveedores de Open Banking (con su consentimiento) para la conexion bancaria</li>
              <li>Proveedores de IA (OpenAI) para la categorizacion de gastos (datos anonimizados)</li>
              <li>Pasarelas de pago (Stripe) para procesar suscripciones</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">6. Seguridad</h2>
            <p>
              Implementamos medidas de seguridad tecnicas y organizativas para proteger sus datos,
              incluyendo cifrado en transito (TLS/SSL), cifrado en reposo, autenticacion segura
              y acceso restringido a los datos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">7. Derechos del usuario</h2>
            <p>
              De acuerdo con el RGPD, usted tiene derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Acceso:</strong> solicitar una copia de sus datos personales</li>
              <li><strong>Rectificacion:</strong> corregir datos inexactos</li>
              <li><strong>Supresion:</strong> solicitar la eliminacion de sus datos</li>
              <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado</li>
              <li><strong>Oposicion:</strong> oponerse al tratamiento de sus datos</li>
              <li><strong>Limitacion:</strong> solicitar la limitacion del tratamiento</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, contacte con nosotros en{" "}
              <a href="mailto:hola@kuentas.eu" className="text-brand-blue underline">hola@kuentas.eu</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">8. Retencion de datos</h2>
            <p>
              Los datos personales se conservan mientras mantenga su cuenta activa. Al eliminar
              su cuenta, los datos se eliminan en un plazo de 30 dias, salvo aquellos que debamos
              conservar por obligaciones legales o fiscales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies esenciales para el funcionamiento de la aplicacion y cookies
              analiticas (con su consentimiento) para mejorar el servicio. Puede gestionar sus
              preferencias de cookies en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">10. Cambios en esta politica</h2>
            <p>
              Nos reservamos el derecho de actualizar esta politica de privacidad. Cualquier
              cambio sera notificado a traves de la aplicacion o por correo electronico.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">11. Contacto</h2>
            <p>
              Para cualquier consulta sobre privacidad, contacte con nosotros en:{" "}
              <a href="mailto:hola@kuentas.eu" className="text-brand-blue underline">hola@kuentas.eu</a>
            </p>
            <p className="mt-2">
              MercadonetGlobal - Espana<br />
              CIF: Pendiente de registro
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-brand-border py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-brand-muted">
          &copy; {new Date().getFullYear()} KUENTAS.EU - MercadonetGlobal. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
