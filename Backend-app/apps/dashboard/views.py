from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.dashboard.permissions import IsSuperadmin
from apps.dashboard.serializers import (
    DashboardGlobalSerializer, 
    VentasPorColmadoSerializer,
    GastosPorColmadoSerializer,
    ColmadoStatsSerializer
)
from apps.ventas.models import Venta, SesionCaja
from apps.inventario.models import Producto
from apps.clientes.models import Cliente
from apps.gastos.models import Gasto
from apps.usuarios.models import Colmado, Usuario
from django.db.models import Sum, Count, Q, F, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsSuperadmin]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Estadísticas globales consolidadas de TODOS los colmados"""
        hoy = timezone.now().date()
        
        # Ventas totales
        ventas_totales = Venta.objects.filter(estado='COMPLETADA').aggregate(
            total=Coalesce(Sum('total'), Decimal('0'))
        )['total']
        
        ventas_hoy = Venta.objects.filter(
            fecha__date=hoy, 
            estado='COMPLETADA'
        ).aggregate(
            total=Coalesce(Sum('total'), Decimal('0'))
        )['total']
        
        # Tickets
        tickets_totales = Venta.objects.filter(estado='COMPLETADA').count()
        tickets_hoy = Venta.objects.filter(fecha__date=hoy, estado='COMPLETADA').count()
        
        # Clientes activos
        clientes_activos = Cliente.objects.filter(activo=True).count()
        
        # Productos
        productos_totales = Producto.objects.filter(activo=True).count()
        productos_bajo_stock = Producto.objects.filter(
            stock_actual__lte=F('stock_minimo'),
            activo=True
        ).count()
        
        # Gastos (Gasto no tiene campo 'activo')
        gastos_totales = Gasto.objects.all().aggregate(
            total=Coalesce(Sum('monto'), Decimal('0'))
        )['total']
        
        gastos_hoy = Gasto.objects.filter(
            fecha__date=hoy
        ).aggregate(
            total=Coalesce(Sum('monto'), Decimal('0'))
        )['total']
        
        # Colmados activos con stats
        colmados = Colmado.objects.filter(activo=True)
        colmados_stats = []
        
        for colmado in colmados:
            ventas_col = Venta.objects.filter(
                colmado=colmado, 
                fecha__date=hoy, 
                estado='COMPLETADA'
            ).aggregate(
                total=Coalesce(Sum('total'), Decimal('0'))
            )['total']
            
            tickets_col = Venta.objects.filter(
                colmado=colmado,
                fecha__date=hoy,
                estado='COMPLETADA'
            ).count()
            
            usuarios_col = Usuario.objects.filter(colmado=colmado, is_active=True).count()
            productos_col = Producto.objects.filter(colmado=colmado, activo=True).count()
            
            colmados_stats.append({
                'id': colmado.id,
                'nombre': colmado.nombre,
                'ventas_hoy': ventas_col,
                'tickets_hoy': tickets_col,
                'usuarios': usuarios_col,
                'productos': productos_col,
            })
        
        data = {
            'periodo': hoy,
            'colmados_activos': colmados.count(),
            'ventas_totales': ventas_totales,
            'ventas_hoy': ventas_hoy,
            'tickets_totales': tickets_totales,
            'tickets_hoy': tickets_hoy,
            'clientes_activos': clientes_activos,
            'productos_totales': productos_totales,
            'productos_bajo_stock': productos_bajo_stock,
            'gastos_totales': gastos_totales,
            'gastos_hoy': gastos_hoy,
            'colmados_stats': colmados_stats,
        }
        
        serializer = DashboardGlobalSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='ventas-por-colmado')
    def ventas_por_colmado(self, request):
        """Desglose de ventas por colmado (últimos 30 días)"""
        hace_30 = timezone.now() - timedelta(days=30)
        
        ventas_por_colmado = Venta.objects.filter(
            fecha__gte=hace_30,
            estado='COMPLETADA'
        ).values('colmado__nombre').annotate(
            total=Coalesce(Sum('total'), Decimal('0')),
            tickets=Count('id')
        ).order_by('-total')
        
        total_general = sum(v['total'] for v in ventas_por_colmado)
        has_data = total_general > 0

        data = []
        for v in ventas_por_colmado:
            porcentaje = (v['total'] / total_general * 100) if has_data else Decimal('0')
            data.append({
                'colmado_nombre': v['colmado__nombre'],
                'total': v['total'],
                'porcentaje': porcentaje,
                'tickets': v['tickets'],
            })

        serializer = VentasPorColmadoSerializer(data, many=True)
        return Response({'has_data': has_data, 'results': serializer.data})

    @action(detail=False, methods=['get'], url_path='gastos-por-colmado')
    def gastos_por_colmado(self, request):
        """Desglose de gastos por colmado (últimos 30 días)"""
        hace_30 = timezone.now() - timedelta(days=30)
        
        gastos_por_colmado = Gasto.objects.filter(
            fecha__gte=hace_30
        ).values('colmado__nombre').annotate(
            total=Coalesce(Sum('monto'), Decimal('0'))
        ).order_by('-total')
        
        total_general = sum(g['total'] for g in gastos_por_colmado)
        has_data = total_general > 0

        data = []
        for g in gastos_por_colmado:
            porcentaje = (g['total'] / total_general * 100) if has_data else Decimal('0')
            data.append({
                'colmado_nombre': g['colmado__nombre'],
                'total': g['total'],
                'porcentaje': porcentaje,
            })

        serializer = GastosPorColmadoSerializer(data, many=True)
        return Response({'has_data': has_data, 'results': serializer.data})

    @action(detail=False, methods=['get'])
    def colmados(self, request):
        """Lista de todos los colmados como dropdown"""
        colmados = Colmado.objects.filter(activo=True).values('id', 'nombre')
        return Response({
            'colmados': list(colmados)
        })
