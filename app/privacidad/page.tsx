import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Política de Privacidad - KUENTAS.EU",
  description: "Política de privacidad de la aplicación KUENTAS.EU. Responsable: MILBROTES, S.L.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-brand-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="KUENTAS.EU" width={28} height={28} />
            <span className="font-bold text-brand-blue">KUENTAS.EU</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-brand-text mb-2">Política de Privacidad</h1>
        <p className="text-brand-muted mb-8">Última actualización: 1 de noviembre de 2026</p>

        <section className="border-l-4 border-brand-blue bg-slate-50 rounded-md px-4 py-3 mb-8 text-sm text-brand-text leading-relaxed">
          <h2 className="font-bold mb-2">Cambio de responsable del tratamiento</h2>
          <p>
            Desde el 30 de octubre de 2026, KUENTAS y el negocio digital al que pertenece se han
            transmitido de MERCADONET GLOBAL, S.L. (NIF B98407901) a <strong>MILBROTES, S.L.</strong>{" "}
            (NIF B05772710), que pasa a ser la responsable del tratamiento. Los datos que nos facilitaste
            antes de esa fecha se han traspasado a MILBROTES, S.L. como parte de la transmisión del negocio
            (artículo 21 de la Ley Orgánica 3/2018, LOPDGDD) y se siguen tratando para las mismas
            finalidades y con la misma base jurídica. Puedes oponerte o pedir su supresión en cualquier
            momento escribiendo a{" "}
            <a href="mailto:kuentas@mercadonet.es" className="text-brand-blue underline">kuentas@mercadonet.es</a>.
          </p>
        </section>

        <div className="prose prose-slate max-w-none space-y-6 text-brand-text text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">1. Responsable del tratamiento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Denominación social:</strong> MILBROTES, S.L.</li>
              <li><strong>NIF:</strong> B05772710</li>
              <li><strong>Domicilio:</strong> Calle Belalcázar, 14, 28006 Madrid (España)</li>
              <li><strong>Datos registrales:</strong> inscrita en el Registro Mercantil de Madrid, hoja M-899621, inscripción 1.ª</li>
              <li>
                <strong>Correo electrónico:</strong>{" "}
                <a href="mailto:kuentas@mercadonet.es" className="text-brand-blue underline">kuentas@mercadonet.es</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">2. Datos que recopilamos</h2>
            <p>KUENTAS.EU puede recopilar los siguientes datos personales:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Nombre completo y NIF (para la facturación)</li>
              <li>Dirección de correo electrónico</li>
              <li>Dirección fiscal</li>
              <li>Datos financieros: movimientos que el usuario importa (CSV), escanea o registra manualmente, ingresos, gastos y facturas</li>
              <li>
                Si activas el módulo Verifactu: los registros de facturación de tus facturas y el certificado
                electrónico que subes para remitirlos a la Agencia Tributaria
              </li>
              <li>Datos de uso de la aplicación (analítica anonimizada)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">3. Finalidad del tratamiento</h2>
            <p>Tus datos se utilizan exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Prestar el servicio de gestión financiera</li>
              <li>Generar facturas</li>
              <li>
                Generar los registros de facturación y remitirlos a la Agencia Estatal de Administración
                Tributaria (AEAT) en la modalidad «VERI*FACTU», cuando el usuario activa ese módulo
              </li>
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
              El tratamiento de datos se basa en el consentimiento del usuario (art. 6.1.a RGPD), la
              ejecución de un contrato (art. 6.1.b RGPD) y el cumplimiento de obligaciones legales
              (art. 6.1.c RGPD). La generación y remisión de los registros de facturación responde a la
              obligación legal del usuario emisor (art. 29.2.j de la Ley 58/2003, General Tributaria, Real
              Decreto 1007/2023 y Orden HAC/1177/2024).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">5. Comunicación de datos y encargados</h2>
            <p>
              No vendemos, alquilamos ni compartimos tus datos personales con terceros con fines
              comerciales. Tus datos pueden ser tratados por:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Proveedores de infraestructura (Vercel, Supabase) para el alojamiento seguro</li>
              <li>OpenAI, para categorizar gastos y extraer los datos de los tickets y facturas que escaneas (OCR)</li>
              <li>Resend, para el envío por correo electrónico de las facturas que tú decides enviar</li>
              <li>
                TPV Virtual de BBVA (Redsys), para el cobro de los planes de pago. Hasta que MILBROTES, S.L.
                active sus propias cuentas de cobro, los cobros y las facturas de los planes de pago los
                emite MERCADONET GLOBAL S.L. (NIF B98407901)
              </li>
              <li>
                La AEAT, a la que se remiten de forma continua, segura y automática los registros de
                facturación cuando el módulo Verifactu está activo (obligación legal)
              </li>
            </ul>
            <p className="mt-2">
              Respecto de los datos personales de los destinatarios de las facturas que emites, tú eres el
              responsable del tratamiento y MILBROTES, S.L. actúa como encargado del tratamiento (art. 28
              RGPD): solo los trata para prestarte el servicio y siguiendo tus instrucciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">6. Seguridad</h2>
            <p>
              Aplicamos medidas de seguridad técnicas y organizativas para proteger tus datos, incluidos
              el cifrado en tránsito (TLS), el cifrado en reposo, la autenticación segura y el acceso
              restringido a los datos. El certificado electrónico que subes para Verifactu se guarda
              cifrado (AES-256-GCM) y solo se usa para identificarte ante la AEAT en la conexión segura
              con la que se remiten tus registros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">7. Derechos del usuario</h2>
            <p>De acuerdo con el RGPD, tienes derecho a:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Acceso:</strong> solicitar una copia de tus datos personales</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos</li>
              <li><strong>Limitación:</strong> solicitar la limitación del tratamiento</li>
            </ul>
            <p className="mt-2">
              Para ejercerlos, escribe a{" "}
              <a href="mailto:kuentas@mercadonet.es" className="text-brand-blue underline">kuentas@mercadonet.es</a>{" "}
              o envía una carta a MILBROTES, S.L., Calle Belalcázar, 14, 28006 Madrid. Si consideras que no
              hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de
              Datos (www.aepd.es).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">8. Conservación de los datos</h2>
            <p>
              Los datos personales se conservan mientras mantengas tu cuenta activa. Al eliminar tu
              cuenta, los datos se eliminan en un plazo de 30 días, salvo los que debamos conservar por
              obligaciones legales o fiscales. En particular, los registros de facturación generados con
              el módulo Verifactu, los envíos a la AEAT y sus respuestas se conservan al menos seis años
              desde la expedición de cada factura, también después de la baja, porque así lo exigen la
              normativa tributaria y mercantil.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies esenciales para el funcionamiento de la aplicación y cookies analíticas
              (con tu consentimiento) para mejorar el servicio. Puedes gestionar tus preferencias de
              cookies en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">10. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política de privacidad. Cualquier cambio se notificará a través de
              la aplicación o por correo electrónico.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mt-8 mb-3">11. Contacto</h2>
            <p>
              Para cualquier consulta sobre privacidad, escribe a{" "}
              <a href="mailto:kuentas@mercadonet.es" className="text-brand-blue underline">kuentas@mercadonet.es</a>.
            </p>
            <p className="mt-2">
              MILBROTES, S.L. · NIF B05772710 · Calle Belalcázar, 14, 28006 Madrid · Inscrita en el
              Registro Mercantil de Madrid, hoja M-899621, inscripción 1.ª
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-brand-border py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-brand-muted">
          &copy; {new Date().getFullYear()} KUENTAS.EU · MILBROTES, S.L. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
