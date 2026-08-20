from django.db import transaction
from django.db.models import Sum
from .models import Devolucion, DevolucionItem
from apps.inventario.models import MovimientoInventario


@transaction.atomic
def crear_devolucion(colmado, cajero, venta, items_data, motivo,
                     metodo_devolucion='EFECTIVO', nota=''):
    """
    Crea una devolución: valida cantidades, reintegra stock,
    registra movimientos y ajusta deuda de fiado si aplica.
    Devuelve el objeto Devolucion creado.
    """
    from apps.ventas.models import VentaDetalle, Venta as VentaModel
    from apps.inventario.models import Producto
    from apps.clientes.models import Cliente

    if venta.estado == VentaModel.ESTADO_ANULADA:
        raise ValueError('No se puede devolver una venta anulada.')

    dev = Devolucion.objects.create(
        colmado=colmado,
        venta=venta,
        cliente=venta.cliente,
        cajero=cajero,
        motivo=motivo,
        nota=nota,
        metodo_devolucion=metodo_devolucion,
        monto_devuelto=0,
    )

    monto_total = 0
    for item_data in items_data:
        venta_item = VentaDetalle.objects.get(pk=item_data['venta_item'], venta=venta)

        ya_devuelto = DevolucionItem.objects.filter(
            venta_item=venta_item,
            devolucion__estado__in=(Devolucion.ESTADO_PENDIENTE, Devolucion.ESTADO_PROCESADA),
        ).aggregate(total=Sum('cantidad'))['total'] or 0

        disponible = venta_item.cantidad - ya_devuelto
        if item_data['cantidad'] > disponible:
            raise ValueError(
                f'Solo puedes devolver {disponible} unidad(es) de '
                f'"{venta_item.producto.nombre}" (ya devueltas: {ya_devuelto}).'
            )

        DevolucionItem.objects.create(
            devolucion=dev,
            venta_item=venta_item,
            cantidad=item_data['cantidad'],
            precio_unitario=venta_item.precio_unitario,
        )
        monto_total += item_data['cantidad'] * venta_item.precio_unitario

        prod = Producto.objects.select_for_update().get(pk=venta_item.producto_id)
        prod.stock_actual += item_data['cantidad']
        prod.save(update_fields=['stock_actual'])

        MovimientoInventario.objects.create(
            colmado=colmado,
            producto=prod,
            tipo=MovimientoInventario.TIPO_ENTRADA,
            cantidad=item_data['cantidad'],
            usuario=cajero,
            nota=f'Devolución #{dev.pk} — {motivo}',
        )

    dev.monto_devuelto = monto_total
    dev.save(update_fields=['monto_devuelto'])

    if venta.metodo_pago == 'FIADO' and venta.cliente and metodo_devolucion == Devolucion.METODO_EFECTIVO:
        from apps.clientes.models import Cliente
        cliente = Cliente.objects.select_for_update().get(pk=venta.cliente_id)
        cliente.saldo_deuda = max(cliente.saldo_deuda - monto_total, 0)
        cliente.save(update_fields=['saldo_deuda'])

    return dev
