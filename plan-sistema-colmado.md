# Plan: Sistema de Inventario y Control para Colmado

## Contexto

Plan construido a partir de dos fuentes:
1. **`levantamiento-sistema-inventario-colmado.md`** — documento de requerimientos con módulos, requerimientos no funcionales y arquitectura sugerida.
2. **Respuestas del cliente** a las 6 preguntas clave del levantamiento.

El objetivo es un sistema POS + inventario para un colmado dominicano, con fiado, multi-cajero, barras + manual, offline-first, granel + empaquetado, y arquitectura multi-tenant preparada para SaaS futuro.

---

## Análisis del Levantamiento vs. Respuestas del Cliente

| Ítem del levantamiento | Respuesta del cliente | Decisión de diseño |
|---|---|---|
| Fiado con control de deuda por cliente | Sí — con límite de crédito y abonos parciales | Módulo `clientes` con `saldo_deuda`, `limite_credito`, tabla `AbonoFiado`, bloqueo en POS si supera límite |
| Multi-cajero simultáneo | 1 o varios | Sesiones de caja independientes (`SesionCaja`); concurrencia con `SELECT ... WITH (UPDLOCK)` en SQL Server |
| Lector de código de barras | Ambos (scanner + manual) | POS acepta input de scanner USB (dispara `keydown Enter`) y búsqueda por nombre/SKU |
| Offline-first | Ambos (offline + online) | Service Worker + IndexedDB en el cliente POS; cola de sincronización al restaurar conexión |
| Escalabilidad SaaS | 1 colmado hoy, más en el futuro | `colmado_id` en todas las tablas; middleware de tenant en Django |
| Productos a granel | Ambos (granel + empaquetado) | Campo `tipo: UNIDAD\|GRANEL`, cantidades como `DECIMAL(10,3)`, UI del POS con teclado decimal para granel |

### Módulos del levantamiento — estado en el plan

| Módulo levantamiento | Incluido | Fase |
|---|---|---|
| 2.1 Inventario (kardex, stock, alertas, granel, auditoría física) | ✅ | 1 y 6 |
| 2.2 POS — escaneo, cambio, métodos pago, fiado, anulación, recibo, descuentos | ✅ | 1 y 2 |
| 2.3 Compras y Suplidores | ✅ | 6 |
| 2.4 Reportes diarios (cierre caja, ventas, ganancia, mermas, fiados, PDF/Excel) | ✅ | 3 |
| 2.5 Dashboard tiempo real (WebSockets, Top5, alertas stock, efectivo en caja) | ✅ | 4 |
| 2.6 Usuarios y Roles (Admin, Cajero, Inventario, auditoría por usuario) | ✅ | 1 |
| 2.7 Clientes (ficha, historial, notificación deuda vencida) | ✅ | 2 |

### Requerimientos no funcionales del levantamiento — cobertura

| RNF | Solución |
|---|---|
| Offline-first (RD: luz/internet inestable) | Service Worker + IndexedDB + sync queue |
| Multiusuario sin duplicar ventas | UPDLOCK + sesiones de caja aisladas |
| Tiempo real (dashboard sin recargar) | Django Channels + WebSockets |
| Backup automático | Celery Beat → tarea nocturna de backup SQL Server |
| Seguridad (auth + roles + contraseñas) | JWT + roles por usuario + bcrypt passwords |
| Rendimiento (miles de productos) | Índices en `codigo_barras`, `sku`, `colmado_id`; paginación en listados |
| Dispositivos variados (tablet/celular/PC baja gama) | Next.js responsive + HeroUI mobile-first; lector USB plug-and-play |
| Escalabilidad multi-sucursal | Multi-tenant desde el modelo de datos |

---

## Stack Tecnológico

- **Backend**: Django 5 + Django REST Framework
- **Tareas asíncronas**: Celery + Redis (cierres nocturnos, alertas stock, reportes, backup)
- **Base de datos**: SQL Server (`mssql-django`)
- **Tiempo real**: Django Channels + WebSockets
- **Frontend/POS**: Next.js 14 + TypeScript + HeroUI
- **Offline**: Service Worker + IndexedDB + Background Sync API
- **Reportes**: WeasyPrint (PDF) + openpyxl (Excel)
- **Auth**: JWT (djangorestframework-simplejwt) + roles por usuario

---

## Modelo de Datos

```
Colmado         (id, nombre, ruc, direccion, config_json)
Usuario         (id, colmado_id, nombre, rol: ADMIN|CAJERO|INVENTARIO, pin_caja, password_hash)
Categoria       (id, colmado_id, nombre)
Producto        (id, colmado_id, sku, codigo_barras, nombre, categoria_id,
                 tipo: UNIDAD|GRANEL, unidad_medida, precio_costo, precio_venta,
                 stock_actual DECIMAL(10,3), stock_minimo, fecha_vencimiento)
Cliente         (id, colmado_id, nombre, telefono, limite_credito, saldo_deuda)
Venta           (id, colmado_id, cajero_id, sesion_caja_id, cliente_id, fecha, total,
                 metodo_pago: EFECTIVO|TARJETA|TRANSFERENCIA|FIADO, estado: COMPLETADA|ANULADA,
                 motivo_anulacion)
VentaDetalle    (id, venta_id, producto_id, cantidad DECIMAL(10,3), precio_unitario, descuento, subtotal)
AbonoFiado      (id, cliente_id, cajero_id, fecha, monto, nota)
MovInventario   (id, colmado_id, producto_id, tipo: ENTRADA|SALIDA|AJUSTE|MERMA,
                 cantidad DECIMAL(10,3), usuario_id, fecha, nota, costo_unitario)
SesionCaja      (id, colmado_id, cajero_id, apertura, cierre,
                 efectivo_inicial, efectivo_final_declarado, efectivo_calculado)
Suplidor        (id, colmado_id, nombre, contacto, notas)
OrdenCompra     (id, suplidor_id, usuario_id, fecha, total, estado: PENDIENTE|RECIBIDA|CANCELADA)
OrdenCompraItem (id, orden_id, producto_id, cantidad, precio_costo)
LogAuditoria    (id, colmado_id, usuario_id, accion, tabla, registro_id, detalle_json, fecha)
```

---

## Módulos a Implementar (en orden de fases)

### Fase 1 — Core POS + Inventario (MVP)
1. Auth: login JWT, roles (ADMIN, CAJERO, INVENTARIO), apertura/cierre sesión de caja
2. CRUD de categorías y productos (soporte granel + barras)
3. Pantalla POS: escaneo barras (evento Enter del scanner) + búsqueda manual, carrito, calcular cambio
4. Registro de venta: descuento stock con UPDLOCK, métodos pago efectivo/tarjeta/transferencia
5. Anulación de venta con motivo, reversión de stock
6. Alertas de stock mínimo (en pantalla y Celery para notificaciones)

### Fase 2 — Fiado y Clientes
7. CRUD de clientes con límite de crédito y saldo deuda
8. Método de pago "Fiado" en POS → acumula saldo, bloquea si supera límite
9. Pantalla de abonos parciales con historial
10. Notificación de deuda vencida (Celery Beat diario)
11. Reporte de cuentas por cobrar

### Fase 3 — Reportes y Cierre de Caja
12. Cierre de caja manual + automático nocturno (Celery Beat)
13. Reporte diario: ventas por hora/producto/empleado, ganancia bruta, mermas, fiados
14. Exportación PDF (WeasyPrint) y Excel (openpyxl)
15. Reporte semanal/mensual comparativo
16. Conteo físico vs. sistema (auditoría inventario)

### Fase 4 — Dashboard en Tiempo Real
17. WebSocket channel (`/ws/dashboard/`) para eventos de venta en vivo
18. Gráfico ventas por hora (actualización automática)
19. Top 5 productos del día
20. Alertas visuales stock crítico
21. Efectivo esperado en caja en tiempo real
22. Comparativo día anterior / mismo día semana pasada

### Fase 5 — Offline-First POS
23. Service Worker que cachea el POS y el catálogo de productos
24. IndexedDB para guardar ventas mientras no hay conexión
25. Cola de sincronización al restaurar conexión (Background Sync)
26. Indicador visual online/offline en el POS

### Fase 6 — Suplidores, Compras y Auditoría
27. CRUD suplidores + historial de compras por suplidor
28. Órdenes de compra → entrada de mercancía → actualiza stock
29. Cuentas por pagar a suplidores (compras a crédito)
30. Log de auditoría completo (LogAuditoria) para cada movimiento
31. Backup automático nocturno de SQL Server (Celery Beat)

---

## Ajustes para SaaS Futuro (sin costo extra hoy)

- `colmado_id` en todas las tablas desde el inicio
- Middleware Django que inyecta el tenant activo por subdominio o JWT claim
- `config_json` en `Colmado` para configuración por negocio (moneda, logo, impuestos, alertas)

---

## Consideraciones Especiales

**Granel**: `cantidad` es `DECIMAL(10,3)`. UI del POS muestra teclado numérico con decimales cuando `tipo=GRANEL`.

**Concurrencia multi-cajero**: `SELECT ... WITH (UPDLOCK, ROWLOCK)` en SQL Server dentro de transacción atómica al descontar stock.

**Fiado + límite**: El POS consulta `Cliente.saldo_deuda` y `limite_credito` antes de permitir un fiado. Si `saldo_deuda + total_venta > limite_credito`, bloquea con mensaje claro.

**Productos próximos a vencer**: Celery Beat revisa diariamente productos con `fecha_vencimiento` dentro de los próximos 7 días y genera alerta.

**Recibo**: Impresión/envío digital es opcional — el sistema genera un recibo en pantalla que puede imprimirse en impresora térmica (ESC/POS) o enviarse por WhatsApp/SMS.

---

## Verificación End-to-End

1. `python manage.py runserver` + `npm run dev` + Redis + Celery
2. **Golden path**: crear producto → venta en POS → stock descuenta → cierre de caja → ver reporte PDF
3. **Fiado**: cliente límite RD$500 → fiado RD$400 → ver saldo → abonar RD$200 → saldo RD$200 → intentar fiado RD$400 → bloqueado
4. **Granel**: vender 1.5 lb arroz → stock descuenta 1.500 unidades
5. **Offline**: desconectar red → venta en POS → reconectar → verificar sync
6. **Multi-cajero**: dos sesiones venden el mismo producto con stock=1 → solo una completa, otra recibe error de stock
7. **Dashboard**: verificar que los datos cambian en tiempo real vía WebSocket al registrar una venta
8. **Roles**: cajero no puede acceder a reportes financieros ni editar precios

---

## Estructura del Proyecto

```
colmado-system/
├── backend/
│   ├── apps/
│   │   ├── usuarios/        # Usuario, roles, JWT auth
│   │   ├── inventario/      # Producto, Categoria, MovInventario
│   │   ├── ventas/          # Venta, VentaDetalle, SesionCaja
│   │   ├── clientes/        # Cliente, AbonoFiado
│   │   ├── compras/         # Suplidor, OrdenCompra
│   │   ├── reportes/        # PDF/Excel, Celery tasks, cierre caja
│   │   └── dashboard/       # WebSocket consumers
│   └── config/              # Settings, URLs, Celery, Channels, mssql-django
├── frontend/
│   ├── app/
│   │   ├── pos/             # Pantalla POS principal
│   │   ├── inventario/      # Gestión productos y categorías
│   │   ├── clientes/        # Fiado, abonos, historial
│   │   ├── reportes/        # Reportes y exportaciones
│   │   └── dashboard/       # Dashboard tiempo real
│   └── public/
│       └── sw.js            # Service Worker offline
└── docker-compose.yml       # SQL Server + Redis + Django + Next.js
```
