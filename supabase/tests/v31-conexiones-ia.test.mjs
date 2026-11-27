// V31 — Migración 20261127100000_conexiones_ia_api_v1 (27-nov-2026) sobre PGlite con el esquema y TODAS las
// migraciones: RLS de tokens, registro y borradores (cada usuario solo ve lo suyo), escritura solo del servidor,
// revocación y cierre de borradores solo de lo propio, y restricciones de permisos.
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SUPA = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } })
let fallos = 0
const check = (n, cond, det = '') => {
  if (cond) console.log(`  ok  ${n}`)
  else {
    fallos++
    console.log(`  MAL ${n}: ${det}`)
  }
}
async function falla(sql) {
  try {
    await db.exec(sql)
    return null
  } catch (e) {
    return e.message
  }
}

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
`)
const ficheros = [
  join(SUPA, 'schema.sql'),
  join(SUPA, 'schema-update.sql'),
  ...readdirSync(join(SUPA, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => join(SUPA, 'migrations', f)),
]
for (const f of ficheros) {
  const e = await falla(readFileSync(f, 'utf8'))
  if (e) check(`aplica ${f.split(/[\\/]/).pop()}`, false, e)
}
check(`esquema y ${ficheros.length - 2} migraciones aplicadas`, fallos === 0)

const A = 'a0000000-0000-4000-8000-00000000000a'
const B = 'b0000000-0000-4000-8000-00000000000b'
const H = (c) => c.repeat(64)
await db.exec(`
  insert into auth.users (id, email) values ('${A}', 'a@ejemplo.invalid'), ('${B}', 'b@ejemplo.invalid');
  insert into invoices (id, user_id, number, client_name, date) values
    ('1a000000-0000-4000-8000-000000000001', '${A}', 'FACT-2026-001', 'Cliente de A', '2026-11-27'),
    ('1b000000-0000-4000-8000-000000000001', '${B}', 'FACT-2026-001', 'Cliente de B', '2026-11-27');
  insert into api_tokens (id, user_id, nombre, origen, hash, prefijo, permisos) values
    ('7a000000-0000-4000-8000-000000000001', '${A}', 'Conector MCP · Claude', 'mcp', '${H('a')}', 'kua_aaaa', array['kuentas:leer','kuentas:borradores']),
    ('7b000000-0000-4000-8000-000000000001', '${B}', 'Conector MCP · ChatGPT', 'mcp', '${H('b')}', 'kua_bbbb', array['kuentas:leer']);
  insert into api_registro (user_id, token_id, metodo, ruta, estado, ms) values
    ('${A}', '7a000000-0000-4000-8000-000000000001', 'GET', '/facturas', 200, 12),
    ('${B}', '7b000000-0000-4000-8000-000000000001', 'GET', '/perfil', 200, 5);
  insert into facturas_borrador_ia (id, user_id, token_id, datos, base, iva, irpf, total) values
    ('ba000000-0000-4000-8000-000000000001', '${A}', '7a000000-0000-4000-8000-000000000001', '{"cliente":{"nombre":"X"}}', 1000, 210, 150, 1060),
    ('ba000000-0000-4000-8000-000000000002', '${A}', null, '{}', 10, 2.1, 0, 12.1),
    ('bb000000-0000-4000-8000-000000000001', '${B}', null, '{}', 10, 2.1, 0, 12.1);
  insert into api_codigos_conexion (hash, user_id, permisos, caduca_at) values ('${H('c')}', '${A}', array['kuentas:leer'], now() + interval '2 minutes');
`)

// Restricciones
check('permisos sin kuentas:leer: rechazado', !!(await falla(`insert into api_tokens (user_id, nombre, hash, prefijo, permisos) values ('${A}', 'x', '${H('d')}', 'kua_dddd', array['kuentas:borradores'])`)))
check('permiso desconocido: rechazado', !!(await falla(`insert into api_tokens (user_id, nombre, hash, prefijo, permisos) values ('${A}', 'x', '${H('e')}', 'kua_eeee', array['kuentas:leer','kuentas:todo'])`)))
check('hash que no es SHA-256 hex: rechazado', !!(await falla(`insert into api_tokens (user_id, nombre, hash, prefijo, permisos) values ('${A}', 'x', 'kua_en_claro', 'kua_ffff', array['kuentas:leer'])`)))
check('hash repetido: rechazado', !!(await falla(`insert into api_tokens (user_id, nombre, hash, prefijo, permisos) values ('${B}', 'x', '${H('a')}', 'kua_aaaa', array['kuentas:leer'])`)))
check('estado de borrador desconocido: rechazado', !!(await falla(`insert into facturas_borrador_ia (user_id, datos, base, iva, irpf, total, estado) values ('${A}', '{}', 1, 0, 0, 1, 'emitido')`)))

// Como el usuario A (authenticated)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);`)
const n = async (sql) => (await db.query(sql)).rows[0].n
check('A solo ve sus tokens', (await n(`select count(*)::int as n from api_tokens`)) === 1)
check('A solo ve su registro', (await n(`select count(*)::int as n from api_registro`)) === 1)
check('A solo ve sus borradores', (await n(`select count(*)::int as n from facturas_borrador_ia`)) === 2)
check('A no puede leer los códigos de conexión', !!(await falla(`select * from api_codigos_conexion`)))
check('A no puede crear tokens', !!(await falla(`insert into api_tokens (user_id, nombre, hash, prefijo, permisos) values ('${A}', 'x', '${H('9')}', 'kua_9999', array['kuentas:leer'])`)))
check('A no puede cambiar permisos de su token', !!(await falla(`update api_tokens set permisos = array['kuentas:leer','kuentas:borradores'] where user_id = '${A}'`)))
check('A no puede crear borradores (solo el servidor)', !!(await falla(`insert into facturas_borrador_ia (user_id, datos, base, iva, irpf, total) values ('${A}', '{}', 1, 0, 0, 1)`)))
check('A no puede escribir en el registro', !!(await falla(`insert into api_registro (user_id, metodo, ruta, estado) values ('${A}', 'GET', '/x', 200)`)))
check('A no puede lanzar la limpieza', !!(await falla(`select api_limpieza()`)))

const rpc = async (sql) => Object.values((await db.query(sql)).rows[0])[0]
check('A no puede revocar el token de B', (await rpc(`select api_token_revocar('7b000000-0000-4000-8000-000000000001')`)) === false)
check('A revoca su token', (await rpc(`select api_token_revocar('7a000000-0000-4000-8000-000000000001')`)) === true)
check('revocar dos veces: false', (await rpc(`select api_token_revocar('7a000000-0000-4000-8000-000000000001')`)) === false)
check('A no puede cerrar el borrador de B', (await rpc(`select borrador_ia_cerrar('bb000000-0000-4000-8000-000000000001', 'descartado')`)) === false)
check('A no puede ligar su borrador a una factura de B', (await rpc(`select borrador_ia_cerrar('ba000000-0000-4000-8000-000000000001', 'convertido', '1b000000-0000-4000-8000-000000000001')`)) === false)
check('A convierte su borrador con su factura', (await rpc(`select borrador_ia_cerrar('ba000000-0000-4000-8000-000000000001', 'convertido', '1a000000-0000-4000-8000-000000000001')`)) === true)
check('un borrador convertido no se puede descartar', (await rpc(`select borrador_ia_cerrar('ba000000-0000-4000-8000-000000000001', 'descartado')`)) === false)
check('estado no permitido por la función', (await rpc(`select borrador_ia_cerrar('ba000000-0000-4000-8000-000000000002', 'pendiente')`)) === false)
check('A descarta el otro borrador', (await rpc(`select borrador_ia_cerrar('ba000000-0000-4000-8000-000000000002', 'descartado')`)) === true)

await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
const tokB = (await db.query(`select revocado_at from api_tokens where id = '7b000000-0000-4000-8000-000000000001'`)).rows[0]
check('el token de B sigue activo', tokB.revocado_at === null)
const borB = (await db.query(`select estado from facturas_borrador_ia where id = 'bb000000-0000-4000-8000-000000000001'`)).rows[0]
check('el borrador de B sigue pendiente', borB.estado === 'pendiente')
const conv = (await db.query(`select estado, invoice_id from facturas_borrador_ia where id = 'ba000000-0000-4000-8000-000000000001'`)).rows[0]
check('borrador convertido apunta a la factura de A', conv.estado === 'convertido' && conv.invoice_id === '1a000000-0000-4000-8000-000000000001')

// Canje atómico: el mismo UPDATE … WHERE usado_at IS NULL que usa la ruta solo vale una vez
const canje = `update api_codigos_conexion set usado_at = now() where hash = '${H('c')}' and usado_at is null and caduca_at > now() returning user_id`
check('código: primer canje vale', (await db.query(canje)).rows.length === 1)
check('código: segundo canje no', (await db.query(canje)).rows.length === 0)

await db.exec(`set role service_role;`)
check('la limpieza la lanza el servidor', !(await falla(`select api_limpieza()`)))
await db.exec(`reset role;`)

console.log(fallos ? `\nV31: ${fallos} fallos` : '\nV31: todo correcto')
process.exit(fallos ? 1 : 0)
