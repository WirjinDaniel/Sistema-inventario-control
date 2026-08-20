from decimal import Decimal
from django.test import TestCase
from apps.usuarios.models import Colmado, Usuario
from apps.inventario.models import Producto, Categoria
from apps.ventas.models import Venta, SesionCaja
from apps.ventas.services import crear_venta
from .models import Devolucion
from .services import crear_devolucion


def _setup():
    colmado = Colmado.objects.create(nombre='Test', ruc='000000001')
    cajero = Usuario.objects.create_user(
        username='cajero2', password='pass1234', nombre='Cajero',
        rol=Usuario.ROL_CAJERO, colmado=colmado,
    )
    sesion = SesionCaja.objects.create(colmado=colmado, cajero=cajero, efectivo_inicial=Decimal('0'))
    cat = Categoria.objects.create(colmado=colmado, nombre='Gen')
    producto = Producto.objects.create(
        colmado=colmado, categoria=cat, nombre='Prod',
        precio_venta=Decimal('100'), precio_costo=Decimal('50'),
        stock_actual=Decimal('10'),
    )
    return colmado, cajero, sesion, producto


class CrearDevolucionServiceTests(TestCase):

    def setUp(self):
        self.colmado, self.cajero, self.sesion, self.producto = _setup()
        detalles = [{'producto': self.producto, 'cantidad': Decimal('4'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        self.venta = crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_EFECTIVO, monto_pagado=400, sesion_caja=self.sesion)
        self.venta_item = self.venta.detalles.first()

    def test_devolucion_reintegra_stock(self):
        items_data = [{'venta_item': self.venta_item.pk, 'cantidad': Decimal('2')}]
        crear_devolucion(self.colmado, self.cajero, self.venta, items_data, 'Producto dañado')
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('8'))

    def test_devolucion_excedente_lanza_error(self):
        items_data = [{'venta_item': self.venta_item.pk, 'cantidad': Decimal('10')}]
        with self.assertRaises(ValueError):
            crear_devolucion(self.colmado, self.cajero, self.venta, items_data, 'Exceso')

    def test_devolucion_venta_anulada_lanza_error(self):
        from apps.ventas.services import anular_venta  # noqa
        anular_venta(self.venta, 'Test', self.cajero)
        items_data = [{'venta_item': self.venta_item.pk, 'cantidad': Decimal('1')}]
        with self.assertRaises(ValueError):
            crear_devolucion(self.colmado, self.cajero, self.venta, items_data, 'Error')

    def test_monto_devuelto_calculado_correctamente(self):
        items_data = [{'venta_item': self.venta_item.pk, 'cantidad': Decimal('3')}]
        dev = crear_devolucion(self.colmado, self.cajero, self.venta, items_data, 'Cambio')
        self.assertEqual(dev.monto_devuelto, Decimal('300'))
