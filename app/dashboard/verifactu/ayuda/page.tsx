import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  FileKey2,
  HelpCircle,
  QrCode,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

// V21 · Ayuda de usuario del módulo Verifactu: guía de activación paso a paso y
// preguntas frecuentes. Contenido estático en lenguaje llano; los datos
// normativos (plazos, artículos, sanciones) proceden de docs/verifactu/SPEC.md,
// verificado contra BOE consolidado y sede AEAT. No es asesoramiento fiscal.

export const metadata = {
  title: "Ayuda Verifactu - KUENTAS.EU",
  description:
    "Cómo activar Verifactu en Kuentas, qué significa cada estado y respuestas a las dudas más frecuentes sobre la remisión de facturas a la AEAT.",
};

// ─── Contenido ────────────────────────────────────────────────────────────────

const PASOS: { titulo: string; detalle: React.ReactNode }[] = [
  {
    titulo: "Completa tus datos fiscales",
    detalle: (
      <>
        Verifactu remite tus facturas a la AEAT a tu nombre, así que tu NIF y tu
        nombre o razón social tienen que estar bien. Revísalos en{" "}
        <Link href="/dashboard/ajustes" className="text-brand-blue hover:underline">
          Ajustes
        </Link>{" "}
        antes de empezar: son los que aparecerán en cada registro de facturación.
      </>
    ),
  },
  {
    titulo: "Pide la activación del módulo",
    detalle: (
      <>
        La activación la realiza el equipo de Kuentas al dar de alta el servicio:
        escríbenos a{" "}
        <a href="mailto:hola@kuentas.eu" className="text-brand-blue hover:underline">
          hola@kuentas.eu
        </a>{" "}
        y la configuramos con tus datos fiscales. Cuando esté lista, el{" "}
        <Link href="/dashboard/verifactu" className="text-brand-blue hover:underline">
          panel Verifactu
        </Link>{" "}
        mostrará el módulo como «Activo», con tu NIF y la modalidad VERI*FACTU.
      </>
    ),
  },
  {
    titulo: "Sube tu certificado digital",
    detalle: (
      <>
        Para enviar tus facturas a la AEAT hace falta tu certificado digital (el
        fichero .p12 o .pfx que descargaste de la FNMT u otra entidad admitida, con
        su contraseña). Súbelo en{" "}
        <Link href="/dashboard/ajustes" className="text-brand-blue hover:underline">
          Ajustes → Certificado digital (VERI*FACTU)
        </Link>
        . Se guarda cifrado y solo se usa para la conexión con la AEAT. Sin
        certificado tus facturas se registran igualmente, pero quedan en cola sin
        remitir hasta que lo subas.
      </>
    ),
  },
  {
    titulo: "Factura como siempre",
    detalle: (
      <>
        No cambia nada en tu día a día: crea tus facturas en{" "}
        <Link href="/dashboard/facturas/nueva" className="text-brand-blue hover:underline">
          Facturas → Nueva factura
        </Link>
        . Con el módulo activo, Kuentas asigna el número correlativo en el
        servidor (por ejemplo <span className="font-mono text-xs">F-2027-000123</span>),
        genera el registro de facturación con su huella encadenada, añade al PDF el
        QR tributario con la leyenda «Factura verificable en la sede electrónica de
        la AEAT» y envía el registro a la AEAT automáticamente.
      </>
    ),
  },
  {
    titulo: "Revisa el panel Verifactu",
    detalle: (
      <>
        En el{" "}
        <Link href="/dashboard/verifactu" className="text-brand-blue hover:underline">
          panel Verifactu
        </Link>{" "}
        ves cada registro con su estado en la AEAT y su CSV (el código de
        verificación que devuelve Hacienda al aceptarlo). Si alguno queda rechazado
        o aceptado con errores, ahí mismo tienes el botón «Subsanar y reenviar».
        También puedes descargar una copia de todos tus registros en el formato
        oficial (sección «Conservación y exportación»).
      </>
    ),
  },
];

const ESTADOS: { icono: React.ReactNode; nombre: string; detalle: string }[] = [
  {
    icono: <Clock className="w-4 h-4 text-brand-muted" />,
    nombre: "Generado / En cola",
    detalle:
      "El registro existe y está esperando su turno de envío. Es lo normal justo después de emitir: la AEAT marca un ritmo de envío (60 segundos entre remisiones) y Kuentas lo respeta.",
  },
  {
    icono: <Send className="w-4 h-4 text-brand-blue" />,
    nombre: "Enviando",
    detalle: "El registro está saliendo hacia la AEAT en este momento.",
  },
  {
    icono: <CheckCircle className="w-4 h-4 text-brand-success" />,
    nombre: "Aceptado",
    detalle:
      "La AEAT lo ha recibido y validado. Verás el CSV del envío en el panel. No tienes que hacer nada.",
  },
  {
    icono: <AlertTriangle className="w-4 h-4 text-brand-warning" />,
    nombre: "Aceptado con errores",
    detalle:
      "La AEAT lo ha admitido pero ha detectado algún dato mejorable (verás el código y la descripción del error). Corrige lo que indique y usa «Subsanar y reenviar»: se genera un registro subsanador y se envía de nuevo.",
  },
  {
    icono: <XCircle className="w-4 h-4 text-brand-danger" />,
    nombre: "Rechazado",
    detalle:
      "La AEAT no lo ha admitido (el motivo aparece en el panel). La factura sigue existiendo en Kuentas: revisa el error y usa «Subsanar y reenviar» para remitirlo correctamente.",
  },
];

const FAQ: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: "¿Quién está obligado a usar Verifactu y desde cuándo?",
    respuesta: (
      <>
        <p>
          La obligación afecta a los empresarios y profesionales que facturan con un
          programa informático (art. 3.1 del RD 1007/2023). Las fechas vigentes, tras
          el RD-ley 15/2025, son:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            <strong>1 de enero de 2027</strong>: sociedades (contribuyentes del
            Impuesto sobre Sociedades).
          </li>
          <li>
            <strong>1 de julio de 2027</strong>: el resto — autónomos (IRPF), no
            residentes con establecimiento permanente y entidades en atribución de
            rentas.
          </li>
        </ul>
        <p className="mt-2">
          Quedan fuera, entre otros: las empresas acogidas al SII (ya remiten sus
          libros registro a la AEAT), los territorios forales (País Vasco tiene
          TicketBAI y Navarra su propio sistema; Kuentas es conforme para territorio
          común) y quien factura sin programa (a mano o con plantillas).
        </p>
      </>
    ),
  },
  {
    pregunta: "Si la obligación empieza en 2027, ¿por qué usarlo ya?",
    respuesta: (
      <p>
        La AEAT admite el envío voluntario desde 2025 y esta fase de rodaje tiene
        ventajas: llegas a la fecha límite con el sistema ya probado, tus facturas
        quedan remitidas y verificables por tus clientes desde el primer día, y
        durante el rodaje puedes abandonar el envío voluntario sin penalización.
        Además, trabajar como VERI*FACTU da presunción de que tu facturación cumple
        los requisitos del reglamento (art. 16.2 RD 1007/2023).
      </p>
    ),
  },
  {
    pregunta: "¿Qué pasa si falla el envío a la AEAT?",
    respuesta: (
      <>
        <p>
          Nada que tengas que arreglar tú en el momento. Tu factura es válida desde
          que se emite: el registro queda generado, con su huella, y el PDF con su QR
          se entrega al cliente igualmente. El envío a la AEAT es un proceso aparte
          que Kuentas gestiona en segundo plano:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            Si la AEAT no responde o hay un corte, Kuentas <strong>reintenta
            automáticamente</strong> (como mínimo una vez por hora, como exige la
            Orden HAC/1177/2024) y marca el envío con el indicador de incidencia que
            pide la norma. En el panel lo verás como «pendiente de envío» hasta que
            entre.
          </li>
          <li>
            Si la AEAT <strong>rechaza</strong> el registro o lo acepta con errores,
            el panel te muestra el motivo y el botón «Subsanar y reenviar».
          </li>
        </ul>
      </>
    ),
  },
  {
    pregunta: "¿Qué es el QR de mis facturas y cómo se comprueba?",
    respuesta: (
      <>
        <p>
          Es el «QR tributario» (art. 21 de la Orden HAC/1177/2024). Contiene la
          dirección del servicio de cotejo de la sede electrónica de la AEAT con los
          datos básicos de la factura: tu NIF, el número, la fecha y el importe
          total. Cualquiera que reciba la factura —tu cliente, una gestoría, la
          propia AEAT— puede escanearlo con el móvil y comprobar en la sede que esa
          factura está remitida.
        </p>
        <p className="mt-2">
          Junto al QR aparece la leyenda «Factura verificable en la sede electrónica
          de la AEAT», que identifica a las facturas emitidas bajo VERI*FACTU. Ten en
          cuenta que el envío respeta la cadencia que marca la AEAT: recién emitida,
          la factura puede tardar unos minutos en aparecer como «encontrada» en el
          cotejo.
        </p>
      </>
    ),
  },
  {
    pregunta: "¿Qué es el CSV que aparece en el panel?",
    respuesta: (
      <p>
        El Código Seguro de Verificación que devuelve la AEAT cuando acepta un
        envío. Es el justificante de que tus registros entraron en sus sistemas; se
        guarda junto a cada registro y puedes verlo (y exportarlo) en el panel
        Verifactu.
      </p>
    ),
  },
  {
    pregunta: "¿Por qué no puedo editar ni borrar una factura emitida?",
    respuesta: (
      <p>
        Porque la ley lo prohíbe: los registros de facturación son inalterables y no
        se pueden borrar (art. 8.2 RD 1007/2023); cada uno lleva una huella
        encadenada con el anterior, de modo que cualquier cambio u omisión sería
        detectable. Para corregir una factura emitida se emite una{" "}
        <strong>factura rectificativa</strong>, y si no debió emitirse, se{" "}
        <strong>anula</strong> con un registro de anulación que también se remite a
        la AEAT. La factura anulada no desaparece: queda marcada como anulada.
      </p>
    ),
  },
  {
    pregunta: "¿Qué certificado digital necesito?",
    respuesta: (
      <p>
        Tu certificado electrónico habitual: el de persona física de la FNMT (o de
        otra entidad admitida por la AEAT), o el de representante si facturas como
        sociedad. Necesitas el fichero exportado (.p12 o .pfx) y su contraseña.
        Kuentas comprueba que corresponde a tu NIF, lo guarda cifrado, te avisa
        cuando esté a punto de caducar y solo lo usa para autenticar la conexión con
        la AEAT. Puedes retirarlo cuando quieras desde Ajustes.
      </p>
    ),
  },
  {
    pregunta: "¿Qué pasa con las facturas que hice antes de activar el módulo?",
    respuesta: (
      <p>
        Se quedan como están: solo las facturas emitidas con el módulo activo
        generan registros de facturación y se remiten a la AEAT. No hay que reenviar
        ni rehacer la facturación anterior.
      </p>
    ),
  },
  {
    pregunta: "¿Puedo dejar de usar VERI*FACTU?",
    respuesta: (
      <p>
        Sí, con una regla: una vez empiezas a funcionar como VERI*FACTU debes
        mantenerlo al menos hasta el 31 de diciembre del año en curso, y la renuncia
        se comunica a la AEAT antes de fin de año (art. 17 de la Orden
        HAC/1177/2024). Durante la fase de rodaje voluntario (antes de tu fecha de
        obligación de 2027) puedes abandonar el envío sin penalización. Si es tu
        caso, escríbenos y lo gestionamos.
      </p>
    ),
  },
  {
    pregunta: "¿Hay sanciones por no cumplir?",
    respuesta: (
      <p>
        Sí. Desde tu fecha de obligación, usar un programa de facturación que no
        cumpla el reglamento puede sancionarse con hasta{" "}
        <strong>50.000 € por ejercicio</strong> (art. 201 bis de la Ley General
        Tributaria). Los fabricantes de software tienen su propio régimen, más duro.
        Con el módulo Verifactu activo, Kuentas genera y remite tus registros
        conforme al reglamento precisamente para que no tengas que preocuparte de
        esto.
      </p>
    ),
  },
  {
    pregunta: "¿Kuentas está homologado por la AEAT?",
    respuesta: (
      <p>
        La AEAT no homologa programas: el sistema funciona por autocertificación del
        fabricante mediante una <strong>declaración responsable</strong> por sistema
        y versión (art. 13 RD 1007/2023), que puedes consultar en cualquier momento{" "}
        <Link href="/verifactu" className="text-brand-blue hover:underline">
          aquí
        </Link>{" "}
        o descargar en PDF desde el panel.
      </p>
    ),
  },
  {
    pregunta: "¿Cómo conservo o exporto mis registros?",
    respuesta: (
      <p>
        No necesitas hacer nada para conservarlos: Kuentas los guarda inalterados
        hasta la prescripción fiscal. Si quieres una copia (para tu gestoría, un
        cambio de programa o un requerimiento), en el panel Verifactu → «Conservación
        y exportación» descargas un ZIP con tus registros en el formato XML oficial
        de la AEAT, con la cadena de huellas verificada y un manifiesto de
        integridad.
      </p>
    ),
  },
  {
    pregunta: "Estoy en modo demo, ¿por qué no veo nada de esto?",
    respuesta: (
      <p>
        El modo demo no genera registros fiscales ni QR: es un entorno de prueba con
        datos locales. Para usar Verifactu necesitas una cuenta real con tus datos
        fiscales.
      </p>
    ),
  },
];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AyudaVerifactuPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/verifactu"
          className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-blue transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al panel Verifactu
        </Link>
        <h1 className="text-2xl font-bold text-brand-text flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-brand-blue" /> Ayuda · Verifactu
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          Qué es, cómo se activa en Kuentas y respuestas a las dudas más frecuentes
        </p>
      </div>

      {/* Qué es */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <h2 className="font-semibold text-brand-text flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-brand-blue" /> ¿Qué es Verifactu?
        </h2>
        <div className="text-sm text-brand-muted leading-relaxed space-y-2">
          <p>
            Verifactu es el sistema con el que Hacienda quiere asegurarse de que las
            facturas que emiten autónomos y empresas no se alteran ni se borran. Lo
            regula el Real Decreto 1007/2023: cada factura genera un{" "}
            <strong>registro de facturación</strong> con una huella electrónica
            encadenada a la anterior, la factura lleva un <strong>código QR</strong>{" "}
            para comprobarla en la sede de la AEAT y, en la modalidad{" "}
            <strong>VERI*FACTU</strong> (la que usa Kuentas), cada registro se envía a
            la AEAT automáticamente en el momento de emitir.
          </p>
          <p>
            Con el módulo activo, todo esto ocurre solo: tú facturas como siempre y
            Kuentas se encarga del registro, del QR y del envío.
          </p>
        </div>
      </div>

      {/* Guía de activación */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <h2 className="font-semibold text-brand-text flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-brand-blue" /> Activa Verifactu en Kuentas
        </h2>
        <p className="text-xs text-brand-muted mb-5">
          Cinco pasos; los tres primeros solo se hacen una vez.
        </p>
        <ol className="space-y-5">
          {PASOS.map((paso, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-blue/10 text-brand-blue text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-brand-text text-sm">{paso.titulo}</p>
                <p className="text-sm text-brand-muted leading-relaxed mt-1">{paso.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-start gap-2 bg-brand-warning/10 border border-brand-warning/30 rounded-lg px-4 py-3">
          <FileKey2 className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
          <p className="text-xs text-brand-text leading-relaxed">
            <strong>Importante:</strong> una vez emitida bajo VERI*FACTU, una factura
            no se puede editar ni borrar (es un requisito legal, no una limitación de
            Kuentas). Para corregirla, emite una rectificativa; si no debió
            emitirse, anúlala.
          </p>
        </div>
      </div>

      {/* Estados */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <h2 className="font-semibold text-brand-text flex items-center gap-2 mb-1">
          <Send className="w-4 h-4 text-brand-blue" /> Qué significa cada estado
        </h2>
        <p className="text-xs text-brand-muted mb-4">
          Cada registro pasa por estos estados en el panel Verifactu.
        </p>
        <ul className="divide-y divide-brand-border/50">
          {ESTADOS.map((e) => (
            <li key={e.nombre} className="py-3 flex gap-3">
              <span className="shrink-0 mt-0.5">{e.icono}</span>
              <div>
                <p className="text-sm font-medium text-brand-text">{e.nombre}</p>
                <p className="text-sm text-brand-muted leading-relaxed mt-0.5">{e.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm">
        <h2 className="font-semibold text-brand-text flex items-center gap-2 mb-4">
          <QrCode className="w-4 h-4 text-brand-blue" /> Preguntas frecuentes
        </h2>
        <div className="divide-y divide-brand-border/50">
          {FAQ.map((item) => (
            <details key={item.pregunta} className="group py-3">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-medium text-brand-text hover:text-brand-blue transition">
                {item.pregunta}
                <span className="text-brand-muted group-open:rotate-90 transition-transform mt-0.5">
                  ›
                </span>
              </summary>
              <div className="text-sm text-brand-muted leading-relaxed mt-2 pr-6">
                {item.respuesta}
              </div>
            </details>
          ))}
        </div>
      </div>

      <p className="text-xs text-brand-muted leading-relaxed">
        Esta guía es informativa y no constituye asesoramiento fiscal. Normativa de
        referencia: Real Decreto 1007/2023, de 5 de diciembre (RRSIF), Orden
        HAC/1177/2024, de 17 de octubre, y Real Decreto-ley 15/2025 (calendario).
        Para tu caso concreto, consulta con tu asesor. ¿Dudas sobre Kuentas?{" "}
        <a href="mailto:hola@kuentas.eu" className="text-brand-blue hover:underline">
          hola@kuentas.eu
        </a>
        .
      </p>
    </div>
  );
}
