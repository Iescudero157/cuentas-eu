# Plan de Lanzamiento KUENTAS.EU
## Estrategia de Go-to-Market con Presupuesto Minimo

**Fecha:** 15 de mayo de 2026
**Preparado para:** Ivan Escudero - MercadonetGlobal

---

## 1. Estado Actual de la Plataforma

### Lo que ya esta construido y funcional:
- Landing page completa con hero, features, pricing, testimonials, FAQ, comparativa vs gestoria
- Dashboard con KPIs en tiempo real, graficos de ingresos vs gastos
- Pagina de Ingresos con grafico circular por fuente, busqueda, exportacion CSV
- Pagina de Gastos con categorizacion IA, filtro por categoria, exportacion CSV
- Sistema de Facturas con creacion, preview en vivo, generacion PDF, estados (cobrada/pendiente/vencida)
- Motor fiscal determinista: IVA trimestral (Modelo 303), IRPF (Modelo 130), tramos progresivos, calendario fiscal con alertas
- Prediccion de Cash Flow a 3 meses con graficos de area
- Gestion de Clientes: CRUD completo con busqueda
- Importacion CSV de transacciones bancarias (soporte multi-formato)
- Sistema de Ajustes: datos personales, actividad, configuracion fiscal, notificaciones
- Onboarding guiado en 4 pasos
- Autenticacion real con Supabase (registro, login, recuperacion de contrasena, verificacion email)
- Modo Demo sin registro (acceso inmediato para explorar)
- Integracion Stripe completa (checkout, webhook, portal de facturacion)
- Categorizacion de gastos con IA (OpenAI + fallback por reglas)
- Alertas fiscales automaticas por email (Vercel Cron + Resend)
- Consentimiento de cookies GDPR
- Paginas legales (Privacidad, Terminos de Servicio)
- API REST completa con autenticacion y RLS en Supabase

### Infraestructura:
- **Dominio:** cuentas.eu (DonDominio)
- **App:** app.kuentas.eu (Vercel)
- **Repositorio:** github.com/Iescudero157/cuentas-eu
- **Base de datos:** Supabase (PostgreSQL con RLS)
- **Pagos:** Stripe (listo para produccion)
- **Emails:** Resend + Gmail API

---

## 2. Pre-requisitos Antes del Lanzamiento

### Semana 1-2: Configuracion de Produccion (0 EUR)

| Tarea | Detalle | Coste |
|-------|---------|-------|
| Configurar Supabase produccion | Crear proyecto en region EU, ejecutar schema.sql, configurar Auth | 0 EUR (free tier: 50K MAU, 500MB DB) |
| Configurar Stripe produccion | Crear productos/precios reales, webhook endpoint produccion | 0 EUR (solo cobra comision por transaccion) |
| Variables de entorno Vercel | Todas las API keys en produccion | 0 EUR |
| Verificar dominio email | Configurar DNS para Resend (envio desde @kuentas.eu) | 0 EUR (incluido en DonDominio) |
| Test E2E manual | Registro, login, factura, impuestos, pago | 0 EUR |

### Semana 2: Contenido y SEO (0 EUR)

| Tarea | Detalle | Coste |
|-------|---------|-------|
| Revisar textos legales | Privacidad y Terminos adaptados a LSSI y RGPD | 0 EUR (ya estan creados, revisar con plantilla AEPD) |
| Schema markup | Agregar SoftwareApplication, FAQPage, Organization | 0 EUR |
| Google Search Console | Verificar propiedad, enviar sitemap | 0 EUR |
| Google Analytics / PostHog | Instalar tracking basico con consent | 0 EUR (PostHog free tier: 1M eventos/mes) |

---

## 3. Estrategia de Lanzamiento (Presupuesto Total: 150-300 EUR)

### Fase 1: Soft Launch - Beta Cerrada (Semana 3-4)

**Objetivo:** 50-100 usuarios beta que validen el producto antes del lanzamiento publico.

| Accion | Canal | Coste |
|--------|-------|-------|
| Post en comunidades de autonomos | Foro de autonomos.info, Reddit r/autonomos, grupos Facebook | 0 EUR |
| Post en Product Hunt (preparar) | Preparar assets, screenshots, descripcion | 0 EUR |
| LinkedIn personal de Ivan | 3-5 posts sobre el problema de los autonomos con Hacienda | 0 EUR |
| Email a contactos directos | Lista personal de autonomos/freelancers conocidos | 0 EUR |
| Beta exclusiva con feedback | Formulario de feedback integrado en la app | 0 EUR |

**KPI objetivo:** 50 registros, 20 usuarios activos, 5 facturas creadas, NPS > 7

### Fase 2: Lanzamiento Publico (Semana 5-6)

**Objetivo:** 500 registros en las primeras 2 semanas.

| Accion | Canal | Coste |
|--------|-------|-------|
| Product Hunt Launch | Dia de lanzamiento coordinado (martes/miercoles) | 0 EUR |
| Hacker News (Show HN) | Post tecnico sobre el stack y la solucion | 0 EUR |
| Twitter/X thread viral | Hilo explicando cuanto paga un autonomo vs lo que deberia + solucion | 0 EUR |
| SEO content (3 articulos) | "Como calcular el IVA trimestral", "Gastos deducibles autonomos 2026", "Modelo 130 guia" | 0 EUR (generados con IA gratuita) |
| Google Ads (test) | Campana de busqueda: "gestoria online autonomos", "calcular IVA autonomo" | 100-150 EUR (primeros 30 dias) |
| Instagram/TikTok Reels | 5-10 reels cortos: tips fiscales + demo de la app | 0 EUR |

### Fase 3: Crecimiento Organico (Mes 2-3)

| Accion | Canal | Coste |
|--------|-------|-------|
| SEO blog (2 articulos/semana) | Contenido pillar sobre impuestos autonomos | 0 EUR |
| Programa de referidos | "Invita a un amigo, 1 mes gratis" (integrado en la app) | 0 EUR (coste = suscripcion regalada) |
| YouTube tutorials | 2-4 videos: "Como usar KUENTAS.EU", "Setup en 2 min" | 0 EUR |
| Partnerships con asesores | Ofrecer version gestoria/export compatible A3/Sage | 0 EUR (win-win, el gestor refiere clientes) |
| Google Ads optimizado | Escalar campanas que conviertan > 3% | 50-150 EUR/mes |

---

## 4. Desglose de Presupuesto Mensual

### Mes 1 (Lanzamiento): 150-200 EUR

| Concepto | Coste |
|----------|-------|
| Dominio cuentas.eu (ya pagado) | 0 EUR |
| Vercel Hobby (ya activo) | 0 EUR |
| Supabase Free Tier | 0 EUR |
| Stripe (solo comision 1.4% + 0.25 EUR/tx) | ~0 EUR (primeros pagos) |
| Resend (3,000 emails/mes free) | 0 EUR |
| Google Ads test | 100-150 EUR |
| Herramientas diseno (Canva free) | 0 EUR |
| Dominio email (incluido en DonDominio) | 0 EUR |
| **Total Mes 1** | **100-150 EUR** |

### Mes 2-3: 100-150 EUR/mes

| Concepto | Coste |
|----------|-------|
| Infraestructura (free tiers) | 0 EUR |
| Google Ads (optimizado) | 50-100 EUR |
| Herramientas SEO (Ubersuggest free) | 0 EUR |
| Contenido (IA gratuita) | 0 EUR |
| Buffer imprevisto | 50 EUR |
| **Total mensual** | **100-150 EUR** |

### Cuando escalar infraestructura (estimacion):
- **> 500 MAU:** Supabase Pro (25 USD/mes) - mejor DB y backups
- **> 50 suscriptores de pago:** Resend Pro (20 USD/mes) - mas emails
- **> 200 suscriptores:** Vercel Pro (20 USD/mes) - analytics y rendimiento
- **Punto de equilibrio:** ~30 suscriptores Plan Autonomo (9.99 EUR x 30 = 300 EUR/mes)

---

## 5. Metricas de Exito

### Mes 1 (Lanzamiento)
| Metrica | Objetivo |
|---------|----------|
| Registros | 200-500 |
| Usuarios activos (MAU) | 100+ |
| Facturas creadas | 50+ |
| Conversion a pago | 3-5% de registros |
| NPS | > 7 |

### Mes 3 (Crecimiento)
| Metrica | Objetivo |
|---------|----------|
| Registros acumulados | 1,000-2,000 |
| MAU | 500+ |
| Suscriptores de pago | 30-50 |
| MRR | 300-500 EUR |
| Churn mensual | < 10% |
| CAC (Google Ads) | < 15 EUR |
| LTV estimado (12 meses) | 120 EUR |

### Mes 6 (Consolidacion)
| Metrica | Objetivo |
|---------|----------|
| Suscriptores de pago | 100-200 |
| MRR | 1,000-2,000 EUR |
| Breakeven infraestructura | Alcanzado |

---

## 6. Roadmap Post-Lanzamiento (P1)

Una vez validado el product-market fit con los primeros 100 clientes:

| Prioridad | Feature | Impacto |
|-----------|---------|---------|
| P1.1 | Open Banking (TrueLayer) | Diferenciacion brutal - importacion automatica |
| P1.2 | OCR de tickets/facturas | Reduccion de entrada manual |
| P1.3 | Multi-moneda (EUR/USD/GBP) | Desbloquea creadores internacionales |
| P1.4 | Conectores YouTube/Twitch/Patreon | Activa el Plan Creator |
| P1.5 | Exportacion formato gestoria (A3/Sage) | Partnership con asesores |
| P1.6 | PWA (notificaciones push) | Retension movil |

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Baja conversion de registros a pago | Alta | Mejorar onboarding, ofrecer trial 14 dias, email nurturing |
| Errores en calculo fiscal | Media | Tests exhaustivos con golden cases, disclaimer visible, recomendacion asesor |
| Competencia (Holded, Quipu, Declarando) | Alta | Foco en precio (desde 0 EUR), UX superior, nicho creadores |
| Requisitos legales facturacion electronica | Baja (a corto) | Arquitectura VERIFACTU-ready, implementar cuando sea obligatorio |
| Free tiers insuficientes | Baja | Escalar a planes de pago cuando ingresos lo justifiquen |

---

## 8. Calendario Resumen

| Semana | Hito |
|--------|------|
| S1-S2 | Configuracion produccion, tests, SEO basico |
| S3-S4 | Beta cerrada (50-100 usuarios), recoger feedback |
| S5 | Product Hunt + lanzamiento publico |
| S6-S8 | Contenido SEO + Google Ads test + optimizacion conversion |
| S9-S12 | Programa referidos + partnerships asesores + iterar con datos |
| S13+ | Evaluacion P1 features segun feedback y metricas |

---

## 9. Conclusion

KUENTAS.EU esta tecnicamente listo para un lanzamiento MVP. La plataforma cubre las necesidades basicas de un autonomo espanol: registro de ingresos/gastos, facturacion legal, estimacion fiscal y alertas. El coste de lanzamiento es extremadamente bajo (150-300 EUR) gracias al uso de free tiers y contenido organico.

**La prioridad numero uno es conseguir los primeros 50 usuarios activos** que validen el producto y generen feedback real. Todo lo demas (Open Banking, OCR, creadores) son mejoras que solo tienen sentido una vez confirmado el product-market fit.

El punto de equilibrio de infraestructura se alcanza con apenas 30 suscriptores del Plan Autonomo. Con una estrategia de contenido SEO consistente y un producto que realmente resuelve el dolor fiscal del autonomo, el crecimiento organico deberia ser el motor principal.
