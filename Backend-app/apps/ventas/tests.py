from decimal import Decimal
from django.test import TestCase
from apps.usuarios.models import Colmado, Usuario
from apps.inventario.models import Producto, Categoria
from apps.clientes.models import Cliente
from .models import Venta, VentaDetalle, SesionCaja
from .services import crear_venta, anular_venta


def _make_colmado():
    return Colmado.objects.create(nombre='Test Colmado', ruc='000000000')


def _make_cajero(colmado):
    return Usuario.objects.create_user(
        username='cajero_test', password='pass1234', nombre='Cajero',
        rol=Usuario.ROL_CAJERO, colmado=colmado,
    )


def _make_sesion(colmado, cajero):
    return SesionCaja.objects.create(colmado=colmado, cajero=cajero, efectivo_inicial=Decimal('0'))


def _make_producto(colmado, stock=10, precio=100):
    cat = Categoria.objects.create(colmado=colmado, nombre='General')
    return Producto.objects.create(
        colmado=colmado, categoria=cat, nombre='Producto Test',
        precio_venta=Decimal(str(precio)), precio_costo=Decimal('50'),
        stock_actual=Decimal(str(stock)),
    )


class CrearVentaServiceTests(TestCase):

    def setUp(self):
        self.colmado = _make_colmado()
        self.cajero = _make_cajero(self.colmado)
        self.sesion = _make_sesion(self.colmado, self.cajero)
        self.producto = _make_producto(self.colmado, stock=10, precio=100)

    def test_venta_descuenta_stock(self):
        detalles = [{'producto': self.producto, 'cantidad': Decimal('3'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        venta = crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_EFECTIVO, monto_pagado=300, sesion_caja=self.sesion)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('7'))
        self.assertEqual(venta.total, Decimal('300'))

    def test_stock_insuficiente_lanza_error(self):
        detalles = [{'producto': self.producto, 'cantidad': Decimal('20'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        with self.assertRaises(ValueError):
            crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_EFECTIVO, monto_pagado=2000, sesion_caja=self.sesion)

    def test_fiado_actualiza_deuda_cliente(self):
        cliente = Cliente.objects.create(
            colmado=self.colmado, nombre='Cliente Test',
            limite_credito=Decimal('500'), saldo_deuda=Decimal('0'),
        )
        detalles = [{'producto': self.producto, 'cantidad': Decimal('2'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_FIADO, cliente=cliente, sesion_caja=self.sesion)
        cliente.refresh_from_db()
        self.assertEqual(cliente.saldo_deuda, Decimal('200'))

    def test_fiado_sin_cliente_lanza_error(self):
        detalles = [{'producto': self.producto, 'cantidad': Decimal('1'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        with self.assertRaises(ValueError):
            crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_FIADO, sesion_caja=self.sesion)


class AnularVentaServiceTests(TestCase):

    def setUp(self):
        self.colmado = _make_colmado()
        self.cajero = _make_cajero(self.colmado)
        self.sesion = _make_sesion(self.colmado, self.cajero)
        self.producto = _make_producto(self.colmado, stock=10, precio=100)
        detalles = [{'producto': self.producto, 'cantidad': Decimal('3'), 'precio_unitario': Decimal('100'), 'descuento': Decimal('0')}]
        self.venta = crear_venta(self.colmado, self.cajero, detalles, Venta.PAGO_EFECTIVO, monto_pagado=300, sesion_caja=self.sesion)

    def test_anular_revierte_stock(self):
        anular_venta(self.venta, 'Error de prueba', self.cajero)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('10'))

    def test_anular_dos_veces_lanza_error(self):
        anular_venta(self.venta, 'Primera anulación', self.cajero)
        with self.assertRaises(ValueError):
            anular_venta(self.venta, 'Segunda anulación', self.cajero)

    def test_anular_sin_motivo_lanza_error(self):
        with self.assertRaises(ValueError):
            anular_venta(self.venta, '', self.cajero)
