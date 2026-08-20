from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta, date
import csv
from django.http import HttpResponse
from apps.dashboard.permissions import IsAdminOfColmado


def get_rango(rango_param, fecha_desde_param, fecha_hasta_param):
    hoy = timezone.now().date()
    if rango_param == 'hoy':
        return hoy, hoy
    elif rango_param == 'semana':
        return hoy - timedelta(days=6), hoy
    elif rango_param == 'mes':
        return hoy.replace(day=1), hoy
    elif rango_param == 'personalizado' and fecha_desde_param and fecha_hasta_param:
        return date.fromisoformat(fecha_desde_param), date.fromisoformat(fecha_hasta_param)
    return hoy, hoy


class ResumenVentasView(APIView):
    """Resumen de ventas por rango de fechas — solo ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.ventas.models import Venta
        rango = request.query_params.get('rango', 'hoy')
        desde, hasta = get_rango(
            rango,
            request.query_params.get('fecha_desde'),
            request.query_params.get('fecha_hasta'),
        )
        ventas = Venta.objects.filter(
            colmado=request.user.colmado,
            fecha__date__gte=desde,
            fecha__date__lte=hasta,
        )
        completadas = ventas.filter(estado=Venta.ESTADO_COMPLETADA)
        totales = completadas.aggregate(
            total_ventas=Sum('total'),
            cantidad=Count('id'),
            ticket_promedio=Avg('total'),
        )
        por_metodo = list(
            completadas.values('metodo_pago')
            .annotate(total=Sum('total'), cantidad=Count('id'))
            .order_by('-total')
        )
        return Response({
            'desde': desde,
            'hasta': hasta,
            'total_ventas': totales['total_ventas'] or 0,
            'cantidad_transacciones': totales['cantidad'] or 0,
            'ticket_promedio': totales['ticket_promedio'] or 0,
            'anuladas': ventas.filter(estado=Venta.ESTADO_ANULADA).count(),
            'por_metodo': por_metodo,
        })


class TendenciaDiariaView(APIView):
    """Tendencia de ventas diarias — solo ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.ventas.models import Venta
        try:
            dias = int(request.query_params.get('dias', 14))
        except (ValueError, TypeError):
            return Response({'detail': 'El parámetro "dias" debe ser un número entero.'}, status=400)
        desde = timezone.now().date() - timedelta(days=dias - 1)
        tendencia = (
            Venta.objects.filter(
                colmado=request.user.colmado,
                estado=Venta.ESTADO_COMPLETADA,
                fecha__date__gte=desde,
            )
            .annotate(dia=TruncDate('fecha'))
            .values('dia')
            .annotate(total=Sum('total'), cantidad=Count('id'))
            .order_by('dia')
        )
        return Response(list(tendencia))


class AnalisisABCView(APIView):
    """Análisis ABC de productos — solo ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.ventas.models import VentaDetalle, Venta
        rango = request.query_params.get('rango', 'mes')
        desde, hasta = get_rango(
            rango,
            request.query_params.get('fecha_desde'),
            request.query_params.get('fecha_hasta'),
        )
        productos = list(
            VentaDetalle.objects.filter(
                venta__colmado=request.user.colmado,
                venta__estado=Venta.ESTADO_COMPLETADA,
                venta__fecha__date__gte=desde,
                venta__fecha__date__lte=hasta,
            )
            .values('producto__nombre', 'producto_id')
            .annotate(
                total_ventas=Sum('subtotal'),
                cantidad_vendida=Sum('cantidad'),
                transacciones=Count('venta', distinct=True),
            )
            .order_by('-total_ventas')
        )
        total_global = sum(float(p['total_ventas'] or 0) for p in productos)
        acumulado = 0
        resultado = []
        for p in productos:
            t = float(p['total_ventas'] or 0)
            acumulado += t
            pct_acum = (acumulado / total_global * 100) if total_global else 0
            resultado.append({
                **p,
                'total_ventas': t,
                'pct_total': round(t / total_global * 100, 2) if total_global else 0,
                'clase': 'A' if pct_acum <= 80 else 'B' if pct_acum <= 95 else 'C',
            })
        try:
            limit = min(int(request.query_params.get('limit', 200)), 500)
        except (ValueError, TypeError):
            limit = 200
        return Response({'desde': desde, 'hasta': hasta, 'total_global': total_global, 'productos': resultado[:limit]})


class ExportarVentasCSVView(APIView):
    """Exportar ventas a CSV — solo ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.ventas.models import Venta
        rango = request.query_params.get('rango', 'mes')
        desde, hasta = get_rango(
            rango,
            request.query_params.get('fecha_desde'),
            request.query_params.get('fecha_hasta'),
        )
        ventas = Venta.objects.filter(
            colmado=request.user.colmado,
            fecha__date__gte=desde,
            fecha__date__lte=hasta,
        ).select_related('cajero', 'cliente').order_by('-fecha')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="ventas_{desde}_{hasta}.csv"'
        response.write('﻿')
        writer = csv.writer(response)
        writer.writerow(['ID', 'Fecha', 'Cajero', 'Cliente', 'Método', 'Subtotal', 'Descuento', 'Total', 'Estado'])
        for v in ventas:
            writer.writerow([
                v.pk, v.fecha.strftime('%d/%m/%Y %H:%M'),
                v.cajero.nombre, v.cliente.nombre if v.cliente else 'General',
                v.metodo_pago, v.subtotal, v.descuento, v.total, v.estado,
            ])
        return response


class StockBajoReporteView(APIView):
    """Reporte de stock bajo — ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.inventario.models import Producto
        from django.db.models import F
        productos = list(
            Producto.objects.filter(colmado=request.user.colmado, activo=True)
            .filter(stock_actual__lte=F('stock_minimo'))
            .values('id', 'nombre', 'sku', 'stock_actual', 'stock_minimo', 'categoria__nombre', 'precio_costo')
            .order_by('stock_actual')
        )
        return Response({'cantidad': len(productos), 'productos': productos[:200]})


class CuentasPorCobrarReporteView(APIView):
    """Reporte de cuentas por cobrar — ADMIN."""
    permission_classes = [IsAdminOfColmado]

    def get(self, request):
        from apps.clientes.models import Cliente
        clientes = list(
            Cliente.objects.filter(colmado=request.user.colmado, saldo_deuda__gt=0)
            .values('id', 'nombre', 'telefono', 'saldo_deuda', 'limite_credito')
            .order_by('-saldo_deuda')
        )
        total = sum(float(c['saldo_deuda']) for c in clientes)
        return Response({'total_pendiente': total, 'clientes_count': len(clientes), 'clientes': clientes})
