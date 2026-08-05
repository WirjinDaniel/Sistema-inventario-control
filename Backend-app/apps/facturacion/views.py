from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Sum, Count
from django.utils import timezone
from .models import SecuenciaNCF, Factura
from .serializers import SecuenciaNCFSerializer, FacturaSerializer, FacturaCreateSerializer
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado, IsCajeroOrAdmin


class SecuenciaNCFViewSet(viewsets.ModelViewSet):
    """Secuencias NCF — solo ADMIN (configuración fiscal del negocio)."""
    serializer_class = SecuenciaNCFSerializer
    permission_classes = [IsAdminOfColmado]
    http_method_names = ['get', 'post', 'patch']

    def get_queryset(self):
        return SecuenciaNCF.objects.filter(colmado=self.request.user.colmado)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class FacturaViewSet(viewsets.ModelViewSet):
    """
    Facturas:
    - Emitir / consultar: CAJERO y ADMIN.
    - Resumen 606 (reporte fiscal): solo ADMIN.
    """
    http_method_names = ['get', 'post', 'patch']

    def get_permissions(self):
        if self.action == 'resumen_606':
            return [IsAdminOfColmado()]
        return [IsCajeroOrAdmin()]

    def get_queryset(self):
        qs = Factura.objects.filter(colmado=self.request.user.colmado)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(ncf__icontains=search) |
                Q(cliente_nombre__icontains=search) |
                Q(cliente_rnc__icontains=search)
            )
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return FacturaCreateSerializer
        return FacturaSerializer

    def create(self, request, *args, **kwargs):
        serializer = FacturaCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        factura = serializer.save()
        audit_log(request, AuditoriaLog.ACCION_VENTA, 'facturacion',
                  f'Factura {factura.ncf} — RD${factura.total}', objeto_id=factura.pk)
        return Response(FacturaSerializer(factura).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='resumen-606')
    def resumen_606(self, request):
        mes = request.query_params.get('mes', timezone.now().strftime('%Y-%m'))
        try:
            year, month = map(int, mes.split('-'))
        except ValueError:
            return Response({'detail': 'Formato de mes inválido. Use YYYY-MM.'}, status=400)

        facturas = Factura.objects.filter(
            colmado=request.user.colmado,
            fecha__year=year,
            fecha__month=month,
            estado=Factura.ESTADO_VALIDA,
        )
        resumen = facturas.values('tipo').annotate(
            cantidad=Count('id'),
            total_monto=Sum('total'),
            total_itbis=Sum('itbis'),
        )
        return Response({
            'mes': mes,
            'tipos': list(resumen),
            'totales': facturas.aggregate(
                total_facturas=Count('id'),
                total_ventas=Sum('total'),
                total_itbis=Sum('itbis'),
            ),
        })
