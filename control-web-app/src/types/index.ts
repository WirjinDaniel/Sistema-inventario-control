export interface ReglaDescuento {
  id: number;
  producto: number | null;
  producto_nombre: string;
  categoria: number | null;
  categoria_nombre: string;
  nombre: string;
  cantidad_minima: string;
  tipo: 'PORCENTAJE' | 'MONTO_FIJO';
  valor: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  sku: string;
  codigo_barras: string;
  precio_costo: string;
  precio_venta: string;
  precio_oferta: string | null;
  oferta_inicio: string | null;
  oferta_fin: string | null;
  precio_vigente: string;
  en_oferta: boolean;
  tipo: "UNIDAD" | "GRANEL";
  unidad_medida: string;
  stock_actual: string;
  stock_minimo: string;
  stock_bajo: boolean;
  margen_ganancia: number;
  categoria: number | null;
  categoria_nombre: string;
  categoria_color: string;
  categoria_icono: string;
  activo: boolean;
  fecha_vencimiento: string | null;
  proveedor: string;
  unidades_por_caja: number | null;
  itbis_exento: boolean;
  notas: string;
  presentaciones: PresentacionProducto[];
  reglas_descuento: ReglaDescuento[];
}

export interface PresentacionProducto {
  id: number;
  producto: number;
  nombre: string;
  factor_conversion: string;
  precio_venta: string;
  codigo_barras: string;
  activo: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  color: string;
  icono: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  cedula: string;
  limite_credito: string;
  saldo_deuda: string;
  credito_disponible: string;
  activo: boolean;
}

export interface AbonoFiado {
  id: number;
  cliente: number;
  cliente_nombre: string;
  cajero_nombre: string;
  monto: string;
  nota: string;
  fecha: string;
}

export interface Venta {
  id: number;
  fecha: string;
  total: string;
  subtotal: string;
  metodo_pago: string;
  estado: string;
  cajero_nombre: string;
  cliente_nombre: string | null;
  banco_nombre: string | null;
}

export interface BancoCuenta {
  id: number;
  banco: string;
  numero_cuenta: string;
  titular: string;
  activo: boolean;
}

export interface CategoriaGasto {
  id: number;
  nombre: string;
  tipo: "FIJO" | "VARIABLE" | "FINANCIERO" | "PERDIDA" | "ADMINISTRATIVO" | "RETIRO";
  icono: string;
  activo: boolean;
  predefinida: boolean;
}

export interface Gasto {
  id: number;
  categoria: number;
  categoria_nombre: string;
  categoria_tipo: string;
  categoria_icono: string;
  usuario_nombre: string;
  descripcion: string;
  monto: string;
  metodo_pago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CHEQUE';
  fecha: string;
  comprobante: string;
  nota: string;
}

export interface Suplidor {
  id: number;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  rnc: string;
  direccion: string;
  tipo_pago: "CONTADO" | "CREDITO";
  dias_credito: number;
  limite_credito: string;
  descuento_habitual: string;
  frecuencia_entrega: string;
  notas: string;
  activo: boolean;
  creado_en: string;
  total_comprado: number;
  total_pagado: number;
  balance_pendiente: number;
  ultima_compra: string | null;
}

export interface SesionCaja {
  id: number;
  cajero: number;
  cajero_nombre: string;
  apertura: string;
  cierre: string | null;
  efectivo_inicial: string;
  efectivo_final_declarado: string | null;
  efectivo_calculado: string | null;
  diferencia_caja: string | null;
  esta_abierta: boolean;
  nota_cierre: string;
}

export interface OrdenCompra {
  id: number;
  suplidor: number;
  suplidor_nombre: string;
  usuario_nombre: string;
  numero_factura: string;
  fecha: string;
  fecha_recepcion: string | null;
  total: string;
  total_pagado: string;
  balance_pendiente: string;
  estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA";
  notas: string;
  items: OrdenCompraItem[];
  pagos: PagoSuplidor[];
}

export interface OrdenCompraItem {
  id: number;
  orden: number;
  producto: number;
  producto_nombre: string;
  cantidad: string;
  precio_costo: string;
  subtotal: string;
}

export interface PagoSuplidor {
  id: number;
  orden: number;
  usuario_nombre: string;
  monto: string;
  fecha: string;
  metodo: "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE";
  referencia: string;
  nota: string;
}
