// Productor FICTICIO para los tests: el productor real (Milbrotes S.L.) no
// tiene NIF hasta el día D (lib/verifactu/productor-sif.ts) y los generadores
// rechazan con razón un SistemaInformatico sin NIF válido. B00000000 es un CIF
// sintácticamente válido usado solo en pruebas; no corresponde a Milbrotes ni a
// Mercadonet (que en los tests sigue siendo el obligado/cliente, B98407901).
export const PRODUCTOR_PRUEBAS = Object.freeze({
  nombreRazon: 'Productor de Pruebas S.L.',
  nif: 'B00000000',
})
