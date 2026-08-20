from decimal import Decimal
from django.db import transaction
from .models import Venta, VentaDetalle
from apps.inventario.models import Producto, MovimientoInventario
from apps.clientes.models import Cliente


@transaction.atomic
def crear_venta(colmado, cajero, detalles_data, metodo_pago, monto_pagado=0,
                descuento=0, cliente=None, sesion_caja=None, banco_cuenta=None):
    """
    Crea una venta completa: valida stock, descuenta inventario,
    registra movimientos y actualiza deuda de fiado.
    Devuelve el objeto Venta creado.
    """
    subtotal = sum(
        d['precio_unitario'] * d['cantidad'] - d.get('descuento', 0)
        for d in detalles_data
    )
    total = subtotal - Decimal(str(descuento))
    cambio = max(Decimal(str(monto_pagado)) - total, 0)

    if metodo_pago == Venta.PAGO_FIADO:
        if not cliente:
            raise ValueError('Se requiere un cliente para venta a fiado.')
        cliente_lock = Cliente.objects.select_for_update().get(pk=cliente.pk)
        if not cliente_lock.puede_fiar(total):
            raise ValueError(
                f'El cliente {cliente_lock.nombre} no tiene crédito suficiente. '
                f'Disponible: RD${cliente_lock.credito_disponible:.2f}'
            )

    venta = Venta.objects.create(
        colmado=colmado,
        cajero=cajero,
        cliente=cliente,
        sesion_caja=sesion_caja,
        banco_cuenta=banco_cuenta,
        metodo_pago=metodo_pago,
        descuento=descuento,
        monto_pagado=monto_pagado,
        subtotal=subtotal,
        total=total,
        cambio=cambio,
    )

    for d in detalles_data:
        prod = Producto.objects.select_for_update().get(pk=d['producto'].pk, colmado=colmado)
        cantidad = d['cantidad']
        if prod.stock_actual < cantidad:
            raise ValueError(f'Stock insuficiente para {prod.nombre}. Disponible: {prod.stock_actual}')
        prod.stock_actual -= cantidad
        prod.save(update_fields=['stock_actual'])

        subtotal_item = d['precio_unitario'] * cantidad - d.get('descuento', 0)
        VentaDetalle.objects.create(venta=venta, subtotal=subtotal_item, **d)

        MovimientoInventario.objects.create(
            colmado=colmado,
            producto=prod,
            tipo=MovimientoInventario.TIPO_SALIDA,
            cantidad=cantidad,
            costo_unitario=prod.precio_costo,
            usuario=cajero,
            nota=f'Venta #{venta.pk}',
        )

    if metodo_pago == Venta.PAGO_FIADO and cliente:
        cliente_lock = Cliente.objects.select_for_update().get(pk=cliente.pk)
        cliente_lock.saldo_deuda += total
        cliente_lock.save(update_fields=['saldo_deuda'])

    return venta


@transaction.atomic
def anular_venta(venta, motivo, usuario):
    """
    Anula una venta: revierte stock, registra movimientos y ajusta deuda de fiado.
    """
    if venta.estado == Venta.ESTADO_ANULADA:
        raise ValueError('La venta ya está anulada.')
    if not motivo:
        raise ValueError('Se requiere un motivo para anular.')

    for detalle in venta.detalles.all():
        prod = Producto.objects.select_for_update().get(pk=detalle.producto_id)
        prod.stock_actual += detalle.cantidad
        prod.save(update_fields=['stock_actual'])
        MovimientoInventario.objects.create(
            colmado=venta.colmado,
            producto=prod,
            tipo=MovimientoInventario.TIPO_AJUSTE,
            cantidad=detalle.cantidad,
            usuario=usuario,
            nota=f'Anulación venta #{venta.pk}: {motivo}',
        )

    if venta.metodo_pago == Venta.PAGO_FIADO and venta.cliente:
        cliente = Cliente.objects.select_for_update().get(pk=venta.cliente_id)
        cliente.saldo_deuda = max(cliente.saldo_deuda - venta.total, 0)
        cliente.save(update_fields=['saldo_deuda'])

    venta.estado = Venta.ESTADO_ANULADA
    venta.motivo_anulacion = motivo
    venta.save(update_fields=['estado', 'motivo_anulacion'])
    return venta
