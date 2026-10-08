// ---------------------------------------------------------------------------
// V18 · Catálogo oficial de validaciones y errores VERI*FACTU de la AEAT.
//
// GENERADO desde docs/verifactu/validaciones/errores.properties (fichero
// oficial servido por la AEAT, conservado intacto; ver FUENTES.md de ese
// directorio para URL, fecha y SHA-256). No editar a mano: si la AEAT publica
// una versión nueva, re-descargar el .properties y regenerar; el test
// v18-errores-aeat.test.mjs verifica la equivalencia código a código.
//
// Ámbitos (las tres secciones del fichero oficial):
//  - 'rechazo_envio':         el envío completo se rechaza (nada se registra).
//  - 'rechazo_registro':      se rechaza la factura afectada (o la petición
//                             completa si el error es de cabecera).
//  - 'aceptado_con_errores':  el registro SE ACEPTA y queda registrado, pero
//                             debe subsanarse posteriormente (SPEC §5.4, V12).
// ---------------------------------------------------------------------------

export type AmbitoErrorAeat = 'rechazo_envio' | 'rechazo_registro' | 'aceptado_con_errores'

export interface ErrorAeat {
  codigo: number
  ambito: AmbitoErrorAeat
  descripcion: string
}

/** Identificación de la fuente oficial del catálogo (trazabilidad). */
export const FUENTE_ERRORES_AEAT = {
  fichero: 'docs/verifactu/validaciones/errores.properties',
  url: 'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties',
  descargado: '2026-09-20',
  sha256: '06519ceb23422bd6b0ad3bfb659e3007615050da4920781d12cff536481d5902',
} as const

export const ERRORES_AEAT: ReadonlyMap<number, ErrorAeat> = new Map<number, ErrorAeat>([
  [4102, { codigo: 4102, ambito: 'rechazo_envio', descripcion: "El XML no cumple el esquema. Falta informar campo obligatorio." }],
  [4103, { codigo: 4103, ambito: 'rechazo_envio', descripcion: "Se ha producido un error inesperado al parsear el XML." }],
  [4104, { codigo: 4104, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo NIF del bloque ObligadoEmision no está identificado." }],
  [4105, { codigo: 4105, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo NIF del bloque Representante no está identificado." }],
  [4106, { codigo: 4106, ambito: 'rechazo_envio', descripcion: "El formato de fecha es incorrecto." }],
  [4107, { codigo: 4107, ambito: 'rechazo_envio', descripcion: "El NIF no está identificado en el censo de la AEAT." }],
  [4108, { codigo: 4108, ambito: 'rechazo_envio', descripcion: "Error técnico al obtener el certificado." }],
  [4109, { codigo: 4109, ambito: 'rechazo_envio', descripcion: "El formato del NIF es incorrecto." }],
  [4110, { codigo: 4110, ambito: 'rechazo_envio', descripcion: "Error técnico al comprobar los apoderamientos." }],
  [4111, { codigo: 4111, ambito: 'rechazo_envio', descripcion: "Error técnico al crear el trámite." }],
  [4112, { codigo: 4112, ambito: 'rechazo_envio', descripcion: "El titular del certificado debe ser Obligado Emisión, Colaborador Social, Apoderado o Sucesor." }],
  [4113, { codigo: 4113, ambito: 'rechazo_envio', descripcion: "El XML no cumple con el esquema: se ha superado el límite permitido de registros para el bloque." }],
  [4114, { codigo: 4114, ambito: 'rechazo_envio', descripcion: "El XML no cumple con el esquema: se ha superado el límite máximo permitido de facturas a registrar." }],
  [4115, { codigo: 4115, ambito: 'rechazo_envio', descripcion: "El valor del campo NIF del bloque ObligadoEmision es incorrecto." }],
  [4116, { codigo: 4116, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el campo NIF del bloque ObligadoEmision tiene un formato incorrecto." }],
  [4117, { codigo: 4117, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el campo NIF del bloque Representante tiene un formato incorrecto." }],
  [4118, { codigo: 4118, ambito: 'rechazo_envio', descripcion: "Error técnico: la dirección no se corresponde con el fichero de entrada." }],
  [4119, { codigo: 4119, ambito: 'rechazo_envio', descripcion: "Error al informar caracteres cuya codificación no es UTF-8." }],
  [4120, { codigo: 4120, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo FechaFinVeriFactu es incorrecto, debe ser 31-12-20XX, donde XX corresponde con el año actual o el anterior." }],
  [4121, { codigo: 4121, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo Incidencia es incorrecto." }],
  [4122, { codigo: 4122, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo RefRequerimiento es incorrecto." }],
  [4123, { codigo: 4123, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo NIF del bloque Representante no está identificado en el censo de la AEAT." }],
  [4124, { codigo: 4124, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo Nombre del bloque Representante no está identificado en el censo de la AEAT." }],
  [4125, { codigo: 4125, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: Si el envío es por requerimiento el campo RefRequerimiento es obligatorio." }],
  [4126, { codigo: 4126, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el campo RefRequerimiento solo debe informarse en sistemas en remisiones al endpoint del servicio a usar para la contestación a requerimientos de registros de facturación." }],
  [4127, { codigo: 4127, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: la remisión voluntaria solo debe informarse en sistemas VERIFACTU." }],
  [4128, { codigo: 4128, ambito: 'rechazo_envio', descripcion: "Error técnico en la recuperación del valor del Gestor de Tablas." }],
  [4129, { codigo: 4129, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el campo FinRequerimiento es obligatorio." }],
  [4130, { codigo: 4130, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el campo FinRequerimiento solo debe informarse en sistemas No VERIFACTU." }],
  [4131, { codigo: 4131, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo FinRequerimiento es incorrecto." }],
  [4132, { codigo: 4132, ambito: 'rechazo_envio', descripcion: "El titular del certificado debe ser el destinatario que realiza la consulta, un Apoderado o Sucesor" }],
  [4133, { codigo: 4133, ambito: 'rechazo_envio', descripcion: "Error en la cabecera: el valor del campo RefRequerimiento no es alfanumérico." }],
  [3500, { codigo: 3500, ambito: 'rechazo_envio', descripcion: "Error técnico de base de datos: error en la integridad de la información." }],
  [3501, { codigo: 3501, ambito: 'rechazo_envio', descripcion: "Error técnico de base de datos." }],
  [3502, { codigo: 3502, ambito: 'rechazo_envio', descripcion: "La factura consultada para el suministro de pagos/cobros/inmuebles no existe." }],
  [3503, { codigo: 3503, ambito: 'rechazo_envio', descripcion: "La factura especificada no pertenece al titular registrado en el sistema." }],
  [4134, { codigo: 4134, ambito: 'rechazo_envio', descripcion: "Servicio no activo." }],
  [4135, { codigo: 4135, ambito: 'rechazo_envio', descripcion: "Esta URL no puede ser utilizada mediante GET." }],
  [4136, { codigo: 4136, ambito: 'rechazo_envio', descripcion: "No se ha enviado el nodo RegistroAlta o el anterior al nodo RegistroAlta no es correcto." }],
  [4137, { codigo: 4137, ambito: 'rechazo_envio', descripcion: "No se ha enviado el nodo RegistroAnulacion o el anterior al nodo RegistroAnulacion no es correcto." }],
  [4138, { codigo: 4138, ambito: 'rechazo_envio', descripcion: "Petición vacía en el XML o encoding incorrecto." }],
  [4139, { codigo: 4139, ambito: 'rechazo_envio', descripcion: "Servicio no habilitado en producción." }],
  [4140, { codigo: 4140, ambito: 'rechazo_envio', descripcion: "No puede acceder a la consulta de facturas al no estar apoderado en los trámites necesarios." }],
  [4141, { codigo: 4141, ambito: 'rechazo_envio', descripcion: "Le informamos que su acceso al sistema VERIFACTU ha sido suspendido temporalmente para realizar cualquier solicitud. Para resolver este inconveniente, le solicitamos que se ponga en contacto con nuestro equipo de soporte a través del buzón de correo electrónico verifactu@correo.aeat.es, donde le atenderán con la mayor brevedad posible." }],
  [1100, { codigo: 1100, ambito: 'rechazo_registro', descripcion: "Valor o tipo incorrecto del campo." }],
  [1101, { codigo: 1101, ambito: 'rechazo_registro', descripcion: "El valor del campo CodigoPais es incorrecto." }],
  [1102, { codigo: 1102, ambito: 'rechazo_registro', descripcion: "El valor del campo IDType es incorrecto." }],
  [1103, { codigo: 1103, ambito: 'rechazo_registro', descripcion: "El valor del campo ID es incorrecto." }],
  [1104, { codigo: 1104, ambito: 'rechazo_registro', descripcion: "El valor del campo NumSerieFactura es incorrecto." }],
  [1105, { codigo: 1105, ambito: 'rechazo_registro', descripcion: "El valor del campo FechaExpedicionFactura es incorrecto." }],
  [1106, { codigo: 1106, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoFactura no está incluido en la lista de valores permitidos." }],
  [1107, { codigo: 1107, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoRectificativa es incorrecto." }],
  [1108, { codigo: 1108, ambito: 'rechazo_registro', descripcion: "El NIF del IDEmisorFactura debe ser el mismo que el NIF del ObligadoEmision." }],
  [1109, { codigo: 1109, ambito: 'rechazo_registro', descripcion: "El NIF no está identificado en el censo de la AEAT." }],
  [1110, { codigo: 1110, ambito: 'rechazo_registro', descripcion: "El NIF no está identificado en el censo de la AEAT." }],
  [1111, { codigo: 1111, ambito: 'rechazo_registro', descripcion: "El campo CodigoPais es obligatorio cuando IDType es distinto de NIF-IVA (02)." }],
  [1112, { codigo: 1112, ambito: 'rechazo_registro', descripcion: "El campo FechaExpedicionFactura es superior a la fecha actual." }],
  [1114, { codigo: 1114, ambito: 'rechazo_registro', descripcion: "Si la factura es de tipo rectificativa, el campo TipoRectificativa debe tener valor." }],
  [1115, { codigo: 1115, ambito: 'rechazo_registro', descripcion: "Si la factura no es de tipo rectificativa, el campo TipoRectificativa no debe tener valor." }],
  [1116, { codigo: 1116, ambito: 'rechazo_registro', descripcion: "Debe informarse el campo FacturasSustituidas sólo si la factura es de tipo F3." }],
  [1117, { codigo: 1117, ambito: 'rechazo_registro', descripcion: "Si la factura no es de tipo rectificativa, el bloque FacturasRectificadas no podrá venir informado." }],
  [1118, { codigo: 1118, ambito: 'rechazo_registro', descripcion: "Si la factura es de tipo rectificativa por sustitución el bloque ImporteRectificacion es obligatorio." }],
  [1119, { codigo: 1119, ambito: 'rechazo_registro', descripcion: "Si la factura no es de tipo rectificativa por sustitución el bloque ImporteRectificacion no debe tener valor." }],
  [1120, { codigo: 1120, ambito: 'rechazo_registro', descripcion: "Valor de campo IDEmisorFactura del bloque IDFactura con tipo incorrecto." }],
  [1121, { codigo: 1121, ambito: 'rechazo_registro', descripcion: "El campo ID no está identificado en el censo de la AEAT." }],
  [1122, { codigo: 1122, ambito: 'rechazo_registro', descripcion: "El campo CodigoPais indicado no coincide con los dos primeros dígitos del identificador." }],
  [1123, { codigo: 1123, ambito: 'rechazo_registro', descripcion: "El formato del NIF es incorrecto." }],
  [1124, { codigo: 1124, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoImpositivo no está incluido en la lista de valores permitidos." }],
  [1125, { codigo: 1125, ambito: 'rechazo_registro', descripcion: "El valor del campo FechaOperacion tiene una fecha superior a la permitida." }],
  [1126, { codigo: 1126, ambito: 'rechazo_registro', descripcion: "El valor del CodigoPais solo puede ser ES cuando el IDType sea Pasaporte (03) o No Censado (07). Si IDType es No Censado (07) el CodigoPais debe ser ES (España)." }],
  [1127, { codigo: 1127, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoRecargoEquivalencia no está incluido en la lista de valores permitidos." }],
  [1128, { codigo: 1128, ambito: 'rechazo_registro', descripcion: "No existe acuerdo de facturación." }],
  [1129, { codigo: 1129, ambito: 'rechazo_registro', descripcion: "Error técnico al obtener el acuerdo de facturación." }],
  [1130, { codigo: 1130, ambito: 'rechazo_registro', descripcion: "El campo NumSerieFactura contiene caracteres no permitidos." }],
  [1131, { codigo: 1131, ambito: 'rechazo_registro', descripcion: "El valor del campo ID ha de ser el NIF de una persona física cuando el campo IDType tiene valor No Censado (07)." }],
  [1132, { codigo: 1132, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoImpositivo es incorrecto, el valor informado solo es permitido para FechaOperacion o FechaExpedicionFactura inferior o igual al año 2012." }],
  [1133, { codigo: 1133, ambito: 'rechazo_registro', descripcion: "El valor del campo FechaExpedicionFactura no debe ser inferior a la fecha actual menos veinte años." }],
  [1134, { codigo: 1134, ambito: 'rechazo_registro', descripcion: "El valor del campo FechaOperacion no debe ser inferior a la fecha actual menos veinte años." }],
  [1135, { codigo: 1135, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoRecargoEquivalencia es incorrecto, el valor informado solo es permitido para FechaOperacion o FechaExpedicionFactura inferior o igual al año 2012." }],
  [1136, { codigo: 1136, ambito: 'rechazo_registro', descripcion: "El campo FacturaSimplificadaArticulos7273 solo acepta valores N o S." }],
  [1137, { codigo: 1137, ambito: 'rechazo_registro', descripcion: "El campo Macrodato solo acepta valores N o S." }],
  [1138, { codigo: 1138, ambito: 'rechazo_registro', descripcion: "El campo Macrodato solo debe ser informado con valor S si el valor de ImporteTotal es igual o superior a +-100.000.000" }],
  [1139, { codigo: 1139, ambito: 'rechazo_registro', descripcion: "Si el campo ImporteTotal está informado y es igual o superior a +-100.000.000 el campo Macrodato debe estar informado con valor S." }],
  [1140, { codigo: 1140, ambito: 'rechazo_registro', descripcion: "Los campos CuotaRepercutida y BaseImponibleACoste deben tener el mismo signo." }],
  [1142, { codigo: 1142, ambito: 'rechazo_registro', descripcion: "El campo CuotaRepercutida tiene un valor incorrecto para el valor de los campos BaseImponibleOimporteNoSujeto y TipoImpositivo suministrados." }],
  [1143, { codigo: 1143, ambito: 'rechazo_registro', descripcion: "Los campos CuotaRepercutida y BaseImponibleOimporteNoSujeto deben tener el mismo signo." }],
  [1144, { codigo: 1144, ambito: 'rechazo_registro', descripcion: "El campo CuotaRepercutida tiene un valor incorrecto para el valor de los campos BaseImponibleACoste y TipoImpositivo suministrados." }],
  [1145, { codigo: 1145, ambito: 'rechazo_registro', descripcion: "Formato de fecha incorrecto." }],
  [1146, { codigo: 1146, ambito: 'rechazo_registro', descripcion: "Sólo se permite que la fecha de expedicion de la factura sea anterior a la fecha operación si los detalles del desglose son ClaveRegimen 14 o 15 e Impuesto 01, 03 o vacío." }],
  [1147, { codigo: 1147, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 14, FechaOperacion es obligatoria y debe ser posterior a la FechaExpedicionFactura." }],
  [1148, { codigo: 1148, ambito: 'rechazo_registro', descripcion: "Si la ClaveRegimen es 14, el campo TipoFactura debe ser F1, R1, R2, R3 o R4." }],
  [1149, { codigo: 1149, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 14, el NIF de Destinatarios debe estar identificado en el censo de la AEAT y comenzar por P, Q, S o V." }],
  [1150, { codigo: 1150, ambito: 'rechazo_registro', descripcion: "Cuando TipoFactura sea F2 y no este informado NumRegistroAcuerdoFacturacion o FacturaSinIdentifDestinatarioArt61d no sea S el sumatorio de BaseImponibleOimporteNoSujeto y CuotaRepercutida de todas las líneas de detalle no podrá ser superior a 3.000." }],
  [1151, { codigo: 1151, ambito: 'rechazo_registro', descripcion: "El campo EmitidaPorTerceroODestinatario solo acepta valores T o D." }],
  [1152, { codigo: 1152, ambito: 'rechazo_registro', descripcion: "La fecha de expedición no puede ser inferior al 28 de octubre de 2024." }],
  [1153, { codigo: 1153, ambito: 'rechazo_registro', descripcion: "Valor del campo RechazoPrevio no válido, solo podrá incluirse el campo RechazoPrevio con valor X si se ha informado el campo Subsanacion y tiene el valor S." }],
  [1154, { codigo: 1154, ambito: 'rechazo_registro', descripcion: "El NIF del emisor de la factura rectificada/sustitutiva no se ha podido identificar en el censo de la AEAT." }],
  [1155, { codigo: 1155, ambito: 'rechazo_registro', descripcion: "Se está informando el bloque Tercero sin estar informado el campo EmitidaPorTerceroODestinatario." }],
  [1156, { codigo: 1156, ambito: 'rechazo_registro', descripcion: "Para el bloque IDOtro y IDType NIF-IVA (02), el valor de TipoFactura es incorrecto." }],
  [1157, { codigo: 1157, ambito: 'rechazo_registro', descripcion: "El valor de cupón solo puede ser S o N si está informado. El valor de cupón sólo puede ser S si el tipo de factura es R1 o R5." }],
  [1158, { codigo: 1158, ambito: 'rechazo_registro', descripcion: "Se está informando EmitidaPorTerceroODestinatario, pero no se informa el bloque correspondiente." }],
  [1159, { codigo: 1159, ambito: 'rechazo_registro', descripcion: "Se está informando del bloque Tercero cuando se indica que se va a informar de Destinatario." }],
  [1160, { codigo: 1160, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 5%, sólo se admite TipoRecargoEquivalencia 0,5 o 0,62." }],
  [1161, { codigo: 1161, ambito: 'rechazo_registro', descripcion: "El valor del campo RechazoPrevio no es válido, no podrá incluirse el campo RechazoPrevio con valor S si no se ha informado del campo Subsanacion o tiene el valor N." }],
  [1162, { codigo: 1162, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 21%, sólo se admite TipoRecargoEquivalencia 5,2 ó 1,75." }],
  [1163, { codigo: 1163, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 10%, sólo se admite TipoRecargoEquivalencia 1,4." }],
  [1164, { codigo: 1164, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 4%, sólo se admite TipoRecargoEquivalencia 0,5." }],
  [1165, { codigo: 1165, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 0% sólo se admite TipoRecargoEquivalencia 0% entre el 1 de enero de 2023 y el 30 de septiembre de 2024." }],
  [1166, { codigo: 1166, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 2% entre el 1 de octubre de 2024 y el 31 de diciembre de 2024, sólo se admite TipoRecargoEquivalencia 0,26." }],
  [1167, { codigo: 1167, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 5% sólo se admite TipoRecargoEquivalencia 0,5 si Fecha Operacion (Fecha Expedicion Factura si no se informa FechaOperacion) es mayor o igual que el 1 de julio de 2022 y el 31 de diciembre de 2022." }],
  [1168, { codigo: 1168, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 5% sólo se admite TipoRecargoEquivalencia 0,62 si Fecha Operacion (Fecha Expedicion Factura si no se informa FechaOperacion) es mayor o igual que el 1 de enero de 2023 y el 30 de septiembre de 2024." }],
  [1169, { codigo: 1169, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 7,5% entre el 1 de octubre de 2024 y el 31 de diciembre de 2024, sólo se admite TipoRecargoEquivalencia 1." }],
  [1170, { codigo: 1170, ambito: 'rechazo_registro', descripcion: "Si el TipoImpositivo es 0%, desde el 1 de octubre del 2024, sólo se admite TipoRecargoEquivalencia 0,26." }],
  [1171, { codigo: 1171, ambito: 'rechazo_registro', descripcion: "El valor del campo Subsanacion o RechazoPrevio no se encuentra en los valores permitidos." }],
  [1172, { codigo: 1172, ambito: 'rechazo_registro', descripcion: "El valor del campo NIF u ObligadoEmision son nulos." }],
  [1173, { codigo: 1173, ambito: 'rechazo_registro', descripcion: "Sólo se permite que la fecha de operación sea superior a la fecha actual si los detalles del desglose son ClaveRegimen 14 o 15 e Impuesto IVA(01) o IGIC(03) o vacío." }],
  [1174, { codigo: 1174, ambito: 'rechazo_registro', descripcion: "El valor del campo FechaExpedicionFactura del bloque RegistroAnteriores incorrecto." }],
  [1175, { codigo: 1175, ambito: 'rechazo_registro', descripcion: "El valor del campo NumSerieFactura del bloque RegistroAnterior es incorrecto." }],
  [1176, { codigo: 1176, ambito: 'rechazo_registro', descripcion: "El valor de campo NIF del bloque SistemaInformatico es incorrecto." }],
  [1177, { codigo: 1177, ambito: 'rechazo_registro', descripcion: "El valor de campo IdSistemaInformatico del bloque SistemaInformatico es incorrecto." }],
  [1178, { codigo: 1178, ambito: 'rechazo_registro', descripcion: "Error en el bloque de Tercero." }],
  [1179, { codigo: 1179, ambito: 'rechazo_registro', descripcion: "Error en el bloque de SistemaInformatico." }],
  [1180, { codigo: 1180, ambito: 'rechazo_registro', descripcion: "Error en el bloque de Encadenamiento." }],
  [1181, { codigo: 1181, ambito: 'rechazo_registro', descripcion: "El valor del campo CalificacionOperacion es incorrecto." }],
  [1182, { codigo: 1182, ambito: 'rechazo_registro', descripcion: "El valor del campo OperacionExenta es incorrecto." }],
  [1183, { codigo: 1183, ambito: 'rechazo_registro', descripcion: "El campo FacturaSimplificadaArticulos7273 solo se podrá rellenar con S si TipoFactura es de tipo F1 o F3 o R1 o R2 o R3 o R4." }],
  [1184, { codigo: 1184, ambito: 'rechazo_registro', descripcion: "El campo FacturaSinIdentifDestinatarioArt61d solo acepta valores S o N." }],
  [1185, { codigo: 1185, ambito: 'rechazo_registro', descripcion: "El campo FacturaSinIdentifDestinatarioArt61d solo se podrá rellenar con S si TipoFactura es de tipo F2 o R5." }],
  [1186, { codigo: 1186, ambito: 'rechazo_registro', descripcion: "Si EmitidaPorTercerosODestinatario es igual a T el bloque Tercero será de cumplimentación obligatoria." }],
  [1187, { codigo: 1187, ambito: 'rechazo_registro', descripcion: "Sólo se podrá cumplimentarse el bloque Tercero si el valor de EmitidaPorTercerosODestinatario es T." }],
  [1188, { codigo: 1188, ambito: 'rechazo_registro', descripcion: "El NIF del bloque Tercero debe ser diferente al NIF del ObligadoEmision." }],
  [1189, { codigo: 1189, ambito: 'rechazo_registro', descripcion: "Si TipoFactura es F1 o F3 o R1 o R2 o R3 o R4 el bloque Destinatarios tiene que estar cumplimentado." }],
  [1190, { codigo: 1190, ambito: 'rechazo_registro', descripcion: "Si TipoFactura es F2 o R5 el bloque Destinatarios no puede estar cumplimentado." }],
  [1191, { codigo: 1191, ambito: 'rechazo_registro', descripcion: "Si TipoFactura es R3 sólo se admitirá NIF o IDType = No Censado (07)." }],
  [1192, { codigo: 1192, ambito: 'rechazo_registro', descripcion: "Si TipoFactura es R2 sólo se admitirá NIF o IDType = No Censado (07) o NIF-IVA (02)." }],
  [1193, { codigo: 1193, ambito: 'rechazo_registro', descripcion: "En el bloque Destinatarios si se identifica mediante NIF, el NIF debe estar identificado y ser distinto del NIF ObligadoEmision." }],
  [1194, { codigo: 1194, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoImpositivo es incorrecto, el valor informado solo es permitido para FechaOperacion o FechaExpedicionFactura posterior o igual a 1 de julio de 2022 e inferior o igual a 30 de septiembre de 2024." }],
  [1195, { codigo: 1195, ambito: 'rechazo_registro', descripcion: "Al menos uno de los dos campos OperacionExenta o CalificacionOperacion deben estar informados." }],
  [1196, { codigo: 1196, ambito: 'rechazo_registro', descripcion: "OperacionExenta o CalificacionOperacion no pueden ser ambos informados ya que son excluyentes entre sí." }],
  [1197, { codigo: 1197, ambito: 'rechazo_registro', descripcion: "Si CalificacionOperacion tiene valor Operación Sujeta y No exenta - Con inversión del sujeto pasivo (S2) TipoFactura solo puede ser F1, F3, R1, R2, R3 y R4." }],
  [1198, { codigo: 1198, ambito: 'rechazo_registro', descripcion: "Si CalificacionOperacion tiene valor Operación Sujeta y No exenta - Con inversión del sujeto pasivo (S2) TipoImpositivo y CuotaRepercutida deberan tener valor 0." }],
  [1199, { codigo: 1199, ambito: 'rechazo_registro', descripcion: "Si Impuesto es '01' (IVA), '03' (IGIC) o no se cumplimenta y ClaveRegimen es 01 no pueden marcarse la OperacionExenta E2, E3." }],
  [1200, { codigo: 1200, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 03 CalificacionOperacion sólo puede ser Operación Sujeta y No exenta - Sin inversión del sujeto pasivo (S1)." }],
  [1201, { codigo: 1201, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 04 CalificacionOperacion sólo puede ser Operación Sujeta y No exenta - Con inversión del sujeto pasivo (S2) o bien OperacionExenta." }],
  [1202, { codigo: 1202, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 06 TipoFactura no puede ser F2, F3, R5 y BaseImponibleACoste debe estar cumplimentado." }],
  [1203, { codigo: 1203, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 07 OperacionExenta no puede ser E2, E3, E4 y E5 o CalificacionOperacion no puede ser S2, N1, N2." }],
  [1205, { codigo: 1205, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 10 CalificacionOperacion tiene que ser N1, TipoFactura F1 y Destinatarios estar identificada mediante NIF." }],
  [1206, { codigo: 1206, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 11 TipoImpositivo ha de ser 21%." }],
  [1207, { codigo: 1207, ambito: 'rechazo_registro', descripcion: "La CuotaRepercutida solo podrá ser distinta de 0 si CalificacionOperacion es Operación Sujeta y No exenta - Sin inversión del sujeto pasivo (S1)." }],
  [1208, { codigo: 1208, ambito: 'rechazo_registro', descripcion: "Si CalificacionOperacion es Operación Sujeta y No exenta - Sin inversión del sujeto pasivo (S1) y BaseImponibleACoste no está cumplimentada, TipoImpositivo y CuotaRepercutida son obligatorios." }],
  [1209, { codigo: 1209, ambito: 'rechazo_registro', descripcion: "Si CalificacionOperacion es Operación Sujeta y No exenta - Sin inversión del sujeto pasivo (S1) y ClaveRegimen es 06, TipoImpositivo y CuotaRepercutida son obligatorios." }],
  [1210, { codigo: 1210, ambito: 'rechazo_registro', descripcion: "El campo ImporteTotal tiene un valor incorrecto para el valor de los campos BaseImponibleOimporteNoSujeto, CuotaRepercutida y CuotaRecargoEquivalencia suministrados." }],
  [1211, { codigo: 1211, ambito: 'rechazo_registro', descripcion: "El bloque Tercero no puede estar identificado con IDType=No Censado (07)." }],
  [1212, { codigo: 1212, ambito: 'rechazo_registro', descripcion: "El campo TipoUsoPosibleSoloVerifactu solo acepta valores N o S." }],
  [1213, { codigo: 1213, ambito: 'rechazo_registro', descripcion: "El campo TipoUsoPosibleMultiOT solo acepta valores N o S." }],
  [1214, { codigo: 1214, ambito: 'rechazo_registro', descripcion: "El campo NumeroOTAlta debe ser nÃºmerico positivo de 4 posiciones." }],
  [1215, { codigo: 1215, ambito: 'rechazo_registro', descripcion: "Error en el bloque de ObligadoEmision." }],
  [1216, { codigo: 1216, ambito: 'rechazo_registro', descripcion: "El campo CuotaTotal tiene un valor incorrecto para el valor de los campos CuotaRepercutida y CuotaRecargoEquivalencia suministrados." }],
  [1217, { codigo: 1217, ambito: 'rechazo_registro', descripcion: "Error identificando el IDEmisorFactura." }],
  [1218, { codigo: 1218, ambito: 'rechazo_registro', descripcion: "El valor del campo Impuesto es incorrecto." }],
  [1219, { codigo: 1219, ambito: 'rechazo_registro', descripcion: "El valor del campo IDEmisorFactura es incorrecto." }],
  [1220, { codigo: 1220, ambito: 'rechazo_registro', descripcion: "El valor del campo NombreSistemaInformatico es incorrecto." }],
  [1221, { codigo: 1221, ambito: 'rechazo_registro', descripcion: "El valor del campo IDType del sistema informático es incorrecto." }],
  [1222, { codigo: 1222, ambito: 'rechazo_registro', descripcion: "El valor del campo ID del bloque IDOtro es incorrecto." }],
  [1223, { codigo: 1223, ambito: 'rechazo_registro', descripcion: "En el bloque SistemaInformatico si se cumplimenta NIF, no deberá existir la agrupación IDOtro y viceversa, pero es obligatorio que se cumplimente uno de los dos." }],
  [1224, { codigo: 1224, ambito: 'rechazo_registro', descripcion: "Si se informa el campo GeneradoPor deberá existir la agrupación Generador y viceversa." }],
  [1225, { codigo: 1225, ambito: 'rechazo_registro', descripcion: "El valor del campo GeneradoPor es incorrecto." }],
  [1226, { codigo: 1226, ambito: 'rechazo_registro', descripcion: "El campo IndicadorMultiplesOT solo acepta valores N o S." }],
  [1227, { codigo: 1227, ambito: 'rechazo_registro', descripcion: "Si el campo GeneradoPor es igual a E debe estar relleno el campo NIF del bloque Generador." }],
  [1228, { codigo: 1228, ambito: 'rechazo_registro', descripcion: "En el bloque Generador si se cumplimenta NIF, no deberá existir la agrupación IDOtro y viceversa, pero es obligatorio que se cumplimente uno de los dos." }],
  [1229, { codigo: 1229, ambito: 'rechazo_registro', descripcion: "Si el valor de GeneradoPor es igual a T el valor del campo IDType del bloque Generador no debe ser No Censado (07)." }],
  [1230, { codigo: 1230, ambito: 'rechazo_registro', descripcion: "Si el valor de GeneradoPor es igual a D y el CodigoPais tiene valor ES (España), el valor del campo IDType del bloque Generador debe ser Pasaporte (03) o No Censado (07)." }],
  [1231, { codigo: 1231, ambito: 'rechazo_registro', descripcion: "El valor del campo IDType del bloque Generador es incorrecto." }],
  [1232, { codigo: 1232, ambito: 'rechazo_registro', descripcion: "Si se identifica a través de la agrupación IDOtro y CodigoPais tiene valor ES (España), el campo IDType debe valer Pasaporte (03)." }],
  [1233, { codigo: 1233, ambito: 'rechazo_registro', descripcion: "Si se identifica a través de la agrupación IDOtro y CodigoPais tiene valor ES (España), el campo IDType debe valer No Censado (07)." }],
  [1234, { codigo: 1234, ambito: 'rechazo_registro', descripcion: "Si se identifica a través de la agrupación IDOtro y CodigoPais tiene valor ES (España), el campo IDType debe valer Pasaporte (03) o No Censado (07)." }],
  [1235, { codigo: 1235, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoImpositivo es incorrecto, el valor informado sólo es permitido para FechaOperacion o FechaExpedicionFactura posterior o igual a 1 de octubre de 2024 e inferior o igual a 31 de diciembre de 2024." }],
  [1236, { codigo: 1236, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoImpositivo es incorrecto, el valor informado solo es permitido para FechaOperacion o FechaExpedicionFactura posterior o igual a 1 de octubre de 2024 e inferior o igual a 31 de diciembre de 2024." }],
  [1237, { codigo: 1237, ambito: 'rechazo_registro', descripcion: "El valor del campo CalificacionOperacion está informado como Operación No sujeta (N1 o N2) y el impuesto es IVA. No se puede informar de los campos TipoImpositivo, CuotaRepercutida, TipoRecargoEquivalencia y CuotaRecargoEquivalencia." }],
  [1238, { codigo: 1238, ambito: 'rechazo_registro', descripcion: "Si la operacion es exenta no se puede informar ninguno de los campos TipoImpositivo, CuotaRepercutida, TipoRecargoEquivalencia y CuotaRecargoEquivalencia." }],
  [1239, { codigo: 1239, ambito: 'rechazo_registro', descripcion: "Error en el bloque Destinatario." }],
  [1240, { codigo: 1240, ambito: 'rechazo_registro', descripcion: "Error en el bloque de IdEmisorFactura." }],
  [1241, { codigo: 1241, ambito: 'rechazo_registro', descripcion: "Error técnico al obtener el SistemaInformatico." }],
  [1242, { codigo: 1242, ambito: 'rechazo_registro', descripcion: "No existe el sistema informático." }],
  [1243, { codigo: 1243, ambito: 'rechazo_registro', descripcion: "Error técnico al obtener el cálculo de la fecha del huso horario." }],
  [1244, { codigo: 1244, ambito: 'rechazo_registro', descripcion: "El campo FechaHoraHusoGenRegistro tiene un formato incorrecto." }],
  [1245, { codigo: 1245, ambito: 'rechazo_registro', descripcion: "Si el campo Impuesto está vacío o tiene valor IVA(01) o IPSI(02) o IGIC(03) el campo ClaveRegimen debe de estar cumplimentado." }],
  [1246, { codigo: 1246, ambito: 'rechazo_registro', descripcion: "El valor del campo ClaveRegimen es incorrecto." }],
  [1247, { codigo: 1247, ambito: 'rechazo_registro', descripcion: "El valor del campo TipoHuella es incorrecto." }],
  [1248, { codigo: 1248, ambito: 'rechazo_registro', descripcion: "El valor del campo Periodo es incorrecto." }],
  [1249, { codigo: 1249, ambito: 'rechazo_registro', descripcion: "El valor del campo IndicadorRepresentante tiene un valor incorrecto." }],
  [1250, { codigo: 1250, ambito: 'rechazo_registro', descripcion: "El valor de fecha desde debe ser menor que el valor de fecha hasta en RangoFechaExpedicion." }],
  [1251, { codigo: 1251, ambito: 'rechazo_registro', descripcion: "El valor del campo IdVersion tiene un valor incorrecto" }],
  [1252, { codigo: 1252, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 08 el campo CalificacionOperacion tiene que tener el valor Operación No sujeta por reglas de localización (N2) e ir siempre informado." }],
  [1253, { codigo: 1253, ambito: 'rechazo_registro', descripcion: "El valor del campo RefExterna tiene un valor incorrecto." }],
  [1254, { codigo: 1254, ambito: 'rechazo_registro', descripcion: "Si FechaOperacion (FechaExpedicionFactura si no se informa FechaOperacion) es anterior a 01/01/2021 no se permite el valor 'XI' para Identificaciones NIF-IVA" }],
  [1255, { codigo: 1255, ambito: 'rechazo_registro', descripcion: "Si FechaOperacion (FechaExpedicionFactura si no se informa FechaOperacion) es mayor o igual que 01/02/2021 no se permite el valor 'GB' para Identificaciones NIF-IVA" }],
  [1256, { codigo: 1256, ambito: 'rechazo_registro', descripcion: "Error técnico al obtener el límite de la fecha de expedición." }],
  [1257, { codigo: 1257, ambito: 'rechazo_registro', descripcion: "El campo BaseImponibleACoste solo puede estar cumplimentado si la ClaveRegimen es = '06' o Impuesto = '02' (IPSI) o Impuesto = '05' (Otros)." }],
  [1258, { codigo: 1258, ambito: 'rechazo_registro', descripcion: "El valor de campo NIF del bloque Generador es incorrecto." }],
  [1259, { codigo: 1259, ambito: 'rechazo_registro', descripcion: "En el bloque Generador si se identifica mediante NIF, el NIF debe estar identificado y ser distinto del NIF ObligadoEmision." }],
  [1260, { codigo: 1260, ambito: 'rechazo_registro', descripcion: "El campo ClaveRegimen solo debe de estar cumplimentado si el campo Impuesto está vacío o tiene valor IVA(01) o IPSI(02) o IGIC(03)" }],
  [1261, { codigo: 1261, ambito: 'rechazo_registro', descripcion: "El campo IndicadorRepresentante solo debe de estar cumplimentado si se consulta por ObligadoEmision" }],
  [1262, { codigo: 1262, ambito: 'rechazo_registro', descripcion: "La longitud de huella no cumple con las especificaciones." }],
  [1263, { codigo: 1263, ambito: 'rechazo_registro', descripcion: "La longitud del tipo de huella no cumple con las especificaciones." }],
  [1264, { codigo: 1264, ambito: 'rechazo_registro', descripcion: "La longitud del campo primer Registro no cumple con las especificaciones." }],
  [1265, { codigo: 1265, ambito: 'rechazo_registro', descripcion: "La longitud del campo tipo factura no cumple con las especificaciones." }],
  [1266, { codigo: 1266, ambito: 'rechazo_registro', descripcion: "La longitud del campo cuota total no cumple con las especificaciones." }],
  [1267, { codigo: 1267, ambito: 'rechazo_registro', descripcion: "La longitud del campo importe total no cumple con las especificaciones." }],
  [1268, { codigo: 1268, ambito: 'rechazo_registro', descripcion: "La longitud del campo FechaHoraHusoGenRegistro no cumple con las especificaciones." }],
  [1269, { codigo: 1269, ambito: 'rechazo_registro', descripcion: "El bloque Registro Anterior no esta informado correctamente." }],
  [1270, { codigo: 1270, ambito: 'rechazo_registro', descripcion: "El valor del campo MostrarNombreRazonEmisor tiene un valor incorrecto." }],
  [1271, { codigo: 1271, ambito: 'rechazo_registro', descripcion: "El valor del campo MostrarSistemaInformatico tiene un valor incorrecto." }],
  [1272, { codigo: 1272, ambito: 'rechazo_registro', descripcion: "Si se consulta por Destinatario el valor del campo MostrarSistemaInformatico debe valer 'N' o no estar cumplimentado." }],
  [1273, { codigo: 1273, ambito: 'rechazo_registro', descripcion: "Error en el bloque de Generador." }],
  [1274, { codigo: 1274, ambito: 'rechazo_registro', descripcion: "Valor incorrecto campo primer registro" }],
  [1275, { codigo: 1275, ambito: 'rechazo_registro', descripcion: "Valor incorrecto campo RechazoPrevio" }],
  [1276, { codigo: 1276, ambito: 'rechazo_registro', descripcion: "Valor incorrecto campo SinRegistroPrevio" }],
  [1277, { codigo: 1277, ambito: 'rechazo_registro', descripcion: "Valor incorrecto del TipoRecargoEquivalencia para el tipo impositivo 0%." }],
  [1281, { codigo: 1281, ambito: 'rechazo_registro', descripcion: "Solo se puede cumplimentar TipoRecargoEquivalencia y CuotaRecargoEquivalencia cuando CalificacionOperacion tiene valor Operación Sujeta y No exenta - Sin inversión del sujeto pasivo (S1)" }],
  [1282, { codigo: 1282, ambito: 'rechazo_registro', descripcion: "Si el NIF de la cabecera es persona fisica se debe informar tambien de su NombreRazon" }],
  [1283, { codigo: 1283, ambito: 'rechazo_registro', descripcion: "Si el NIF de la contraparte es persona fisica se debe informar tambien de su NombreRazon" }],
  [1284, { codigo: 1284, ambito: 'rechazo_registro', descripcion: "Si se ha informado de TipoRecargoEquivalencia tambien se debe informar de CuotaRecargoEquivalencia y viceversa." }],
  [1285, { codigo: 1285, ambito: 'rechazo_registro', descripcion: "Se han encontracado varios Sistemas Informáticos con los datos suministrados, debe filtrar la consulta por más campos del Sistema Informático." }],
  [1286, { codigo: 1286, ambito: 'rechazo_registro', descripcion: "Si el impuesto es IVA(01), IGIC(03) o vacio, si ClaveRegimen es 02 solo se podrá informar OperacionExenta." }],
  [1287, { codigo: 1287, ambito: 'rechazo_registro', descripcion: "El valor del campo %s contiene carácteres no validos (<, >, \", ', =)." }],
  [1288, { codigo: 1288, ambito: 'rechazo_registro', descripcion: "Error técnico en la validación de la fecha de expedición/operación." }],
  [1289, { codigo: 1289, ambito: 'rechazo_registro', descripcion: "Si Impuesto es IVA(01) o vacio y si el campo OperacionExenta es igual a 'E5' sólo deberá existir la agrupación IDOtro en el bloque Destinatario." }],
  [1290, { codigo: 1290, ambito: 'rechazo_registro', descripcion: "El campo ID no contiene un NIF con formato correcto." }],
  [1291, { codigo: 1291, ambito: 'rechazo_registro', descripcion: "El HASH del Registro anterior no es alfanumérico." }],
  [1292, { codigo: 1292, ambito: 'rechazo_registro', descripcion: "El HASH no es alfanumérico." }],
  [1293, { codigo: 1293, ambito: 'rechazo_registro', descripcion: "Si ClaveRegimen es 20 el campo CalificacionOperacion tiene que tener el valor Operación No sujeta por reglas de localización (N2) e ir siempre informado." }],
  [3000, { codigo: 3000, ambito: 'rechazo_registro', descripcion: "Registro de facturación duplicado." }],
  [3001, { codigo: 3001, ambito: 'rechazo_registro', descripcion: "El registro de facturación ya ha sido dado de baja." }],
  [3002, { codigo: 3002, ambito: 'rechazo_registro', descripcion: "No existe el registro de facturación." }],
  [3003, { codigo: 3003, ambito: 'rechazo_registro', descripcion: "El presentador no tiene los permisos necesarios para actualizar este registro de facturación." }],
  [3004, { codigo: 3004, ambito: 'rechazo_registro', descripcion: "No es posible modificar la factura ya que ha sido dada de alta vía formulario." }],
  [2000, { codigo: 2000, ambito: 'aceptado_con_errores', descripcion: "El cálculo de la huella suministrada es incorrecta." }],
  [2001, { codigo: 2001, ambito: 'aceptado_con_errores', descripcion: "El NIF del bloque Destinatarios no está identificado en el censo de la AEAT." }],
  [2002, { codigo: 2002, ambito: 'aceptado_con_errores', descripcion: "La longitud de huella del registro anterior no cumple con las especificaciones." }],
  [2003, { codigo: 2003, ambito: 'aceptado_con_errores', descripcion: "El contenido de la huella del registro anterior no cumple con las especificaciones." }],
  [2004, { codigo: 2004, ambito: 'aceptado_con_errores', descripcion: "El valor del campo FechaHoraHusoGenRegistro debe ser la fecha actual del sistema de la AEAT, admitiéndose un margen de error de:" }],
  [2005, { codigo: 2005, ambito: 'aceptado_con_errores', descripcion: "El campo ImporteTotal tiene un valor incorrecto para el valor de los campos BaseImponibleOimporteNoSujeto, CuotaRepercutida y CuotaRecargoEquivalencia suministrados." }],
  [2006, { codigo: 2006, ambito: 'aceptado_con_errores', descripcion: "El campo CuotaTotal tiene un valor incorrecto para el valor de los campos CuotaRepercutida y CuotaRecargoEquivalencia suministrados." }],
  [2007, { codigo: 2007, ambito: 'aceptado_con_errores', descripcion: "No debe informarse como primer registro, existen facturas emitidas con el obligado emisión y el sistema informático actual." }],
  [2008, { codigo: 2008, ambito: 'aceptado_con_errores', descripcion: "El valor de la huella del registro anterior debe ser diferente a la huella del registro actual." }],
  [2009, { codigo: 2009, ambito: 'aceptado_con_errores', descripcion: "Si el campo Impuesto tiene valor IPSI(02) el campo ClaveRegimen debe de estar cumplimentado." }],
])

/** Entrada del catálogo, o undefined si el código no está catalogado. */
export function errorAeat(codigo: number): ErrorAeat | undefined {
  return ERRORES_AEAT.get(codigo)
}

/** «[1142] descripción…» — para logs, panel y batería de conformidad. */
export function descripcionErrorAeat(codigo: number): string {
  const e = ERRORES_AEAT.get(codigo)
  return e ? `[${e.codigo}] ${e.descripcion}` : `[${codigo}] Código no catalogado (revisar errores.properties de la AEAT)`
}

/** true si el código rechaza el envío completo (sección 1 del catálogo). */
export function esRechazoEnvio(codigo: number): boolean {
  return ERRORES_AEAT.get(codigo)?.ambito === 'rechazo_envio'
}

/** true si el código rechaza la factura o la petición (sección 2). */
export function esRechazoRegistro(codigo: number): boolean {
  return ERRORES_AEAT.get(codigo)?.ambito === 'rechazo_registro'
}

/**
 * true si el registro queda ACEPTADO con errores (sección 3): está registrado
 * en la AEAT y debe subsanarse después con Subsanacion=S (flujo V12).
 */
export function esAceptadoConErrores(codigo: number): boolean {
  return ERRORES_AEAT.get(codigo)?.ambito === 'aceptado_con_errores'
}

/** Rechazo por duplicado (3000): tratamiento idempotente (SPEC §5.4, V09/V10). */
export const CODIGO_DUPLICADO = 3000
