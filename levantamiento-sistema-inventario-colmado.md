# Levantamiento de Requerimientos
## Sistema de Control de Inventario y Reportes para Colmado

---

## 1. Objetivo del Sistema

Desarrollar un sistema que permita:
- Controlar el inventario en tiempo real (entradas, salidas, existencias).
- Registrar ventas de forma ágil (tipo punto de venta).
- Generar reportes diarios automáticos (ventas, cierre de caja, ganancias, productos más vendidos, stock bajo).
- Visualizar un dashboard en tiempo real con los indicadores clave del negocio.
- Prevenir pérdidas por robo, vencimiento o mal manejo de inventario.

---

## 2. Módulos Principales

### 2.1 Módulo de Inventario
- Registro de productos: código/SKU, código de barras, nombre, categoría, unidad de medida (unidad, libra, galón, caja, etc.), precio de costo, precio de venta, margen de ganancia.
- Manejo de existencias por producto (stock actual).
- Entradas de mercancía (compras a suplidores).
- Salidas de mercancía (ventas, mermas, ajustes, consumo interno).
- Alertas de stock bajo / mínimo configurable por producto.
- Alertas de productos próximos a vencer (si aplica a víveres, lácteos, embutidos).
- Historial de movimientos por producto (kardex).
- Manejo de productos a granel vs. empaquetados.
- Conteo físico / auditoría de inventario (para cuadrar sistema vs. físico).

### 2.2 Módulo de Ventas (Punto de Venta - POS)
- Pantalla rápida de venta (escaneo de código de barras o búsqueda manual).
- Cálculo automático de cambio.
- Métodos de pago: efectivo, tarjeta, transferencia, fiado/crédito a clientes.
- Registro de "fiado" (muy común en colmados) con control de deuda por cliente.
- Anulación/devolución de ventas con motivo.
- Impresión o envío digital de recibo (opcional).
- Descuentos por producto o por venta.

### 2.3 Módulo de Compras y Suplidores
- Registro de suplidores (nombre, contacto, productos que suple).
- Órdenes de compra.
- Historial de compras por suplidor.
- Cuentas por pagar a suplidores (si compran a crédito).

### 2.4 Módulo de Reportes Diarios
Reportes mínimos que un colmado necesita:
- **Cierre de caja diario**: total vendido, efectivo vs. tarjeta vs. fiado, diferencia de caja (esperado vs. contado).
- **Ventas del día**: por hora, por producto, por categoría, por empleado (si hay varios cajeros).
- **Productos más y menos vendidos**.
- **Ganancia bruta del día** (venta - costo).
- **Inventario bajo / a reponer**.
- **Reporte de mermas** (productos dañados, vencidos, robados).
- **Estado de cuentas por cobrar (fiados)**.
- **Reporte semanal/mensual** consolidado (comparativo).
- Exportación a PDF/Excel.

### 2.5 Dashboard en Tiempo Real
- Ventas acumuladas del día (actualizándose sin recargar la página).
- Gráfico de ventas por hora.
- Top 5 productos vendidos hoy.
- Alertas visuales de stock crítico.
- Efectivo esperado en caja en este momento.
- Comparación con el día anterior / mismo día semana pasada.
- Indicador de fiados pendientes.

### 2.6 Módulo de Usuarios y Roles
- **Dueño/Administrador**: acceso total, reportes, configuración.
- **Cajero/Empleado**: solo acceso a ventas, no puede editar precios ni ver reportes financieros.
- **Encargado de inventario** (si aplica): entradas/salidas de mercancía.
- Registro de qué usuario hizo cada movimiento (auditoría/trazabilidad).

### 2.7 Módulo de Clientes (para fiado)
- Ficha de cliente: nombre, teléfono, límite de crédito.
- Historial de fiados y pagos.
- Notificación de deuda vencida.

---

## 3. Requerimientos No Funcionales

| Requerimiento | Detalle |
|---|---|
| **Disponibilidad offline** | Muy importante en RD: el sistema debe poder seguir vendiendo aunque se caiga el internet, y sincronizar después (considerando que la energía/internet no siempre es estable). |
| **Multiusuario** | Varios cajeros/dispositivos operando a la vez sin duplicar ventas ni descuadrar inventario. |
| **Tiempo real** | El dashboard debe reflejar cambios sin recargar (WebSockets o polling corto). |
| **Backup automático** | Respaldo diario de la base de datos. |
| **Seguridad** | Autenticación por usuario, permisos por rol, contraseñas seguras. |
| **Rendimiento** | Debe responder rápido incluso con miles de productos y ventas históricas. |
| **Dispositivo** | Debe funcionar bien en tablet/celular/PC de gama baja (hardware típico de colmado) y idealmente con lector de código de barras USB. |
| **Escalabilidad** | Pensado para 1 colmado, pero con posibilidad de crecer a varias sucursales. |

---

## 4. Preguntas Clave Antes de Diseñar (para afinar el alcance)

1. ¿El colmado maneja fiado a clientes? (muy común, cambia bastante el diseño)
2. ¿Cuántos cajeros/puntos de venta habrá trabajando al mismo tiempo?
3. ¿Van a usar lector de código de barras o entrada manual?
4. ¿Necesitas que funcione sin internet (offline-first) o siempre hay conexión?
5. ¿Es para un solo colmado o piensas replicarlo a varios negocios (modelo de producto/SaaS)?
6. ¿Vas a manejar productos a granel (arroz, habichuela por libra) además de empaquetados?

---

## 5. Propuesta de Arquitectura Técnica (sugerida)

Aprovechando tu experiencia actual con viáticos-web-app, podrías reutilizar buena parte del stack:

- **Backend**: Django REST Framework (API), Celery + Redis (tareas en segundo plano: reportes diarios automáticos, alertas de stock, cierre de caja programado).
- **Base de datos**: PostgreSQL o SQL Server (ya tienes experiencia con SQL Server).
- **Frontend**: Next.js + TypeScript + HeroUI (mismo patrón visual que ya dominas).
- **Tiempo real**: WebSockets (Django Channels) o polling cada pocos segundos para el dashboard.
- **Offline-first (opcional)**: IndexedDB en el POS + sincronización cuando vuelva la conexión.
- **Reportes**: generación en PDF (WeasyPrint o similar) + Celery Beat para generar el reporte de cierre automáticamente cada noche.

---

## 6. Roadmap Sugerido (fases)

1. **Fase 1 – Core**: productos, inventario, ventas básicas (POS).
2. **Fase 2 – Reportes diarios y cierre de caja**.
3. **Fase 3 – Dashboard en tiempo real**.
4. **Fase 4 – Fiado, clientes y cuentas por cobrar**.
5. **Fase 5 – Suplidores y compras**.
6. **Fase 6 – Multiusuario/roles + auditoría + offline**.

---

*Documento generado como punto de partida. Se recomienda validar con el dueño/operador real del colmado los puntos de la sección 4 antes de iniciar el desarrollo.*
