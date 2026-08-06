from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Sum, Count
from django.utils import timezone
from .models import SecuenciaNCF, Factura, PagoFactura
from .serializers import (
    SecuenciaNCFSerializer, FacturaSerializer, FacturaCreateSerializer, PagoFacturaSerializer,
)
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado, IsCajeroOrAdmin


class SecuenciaNCFViewSet(viewsets.ModelViewSet):
    serializer_class = SecuenciaNCFSerializer
    permission_classes = [IsAdminOfColmado]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        return SecuenciaNCF.objects.filter(colmado=self.request.user.colmado)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class FacturaViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch']

    def get_permissions(self):
        if self.action in ('resumen_606', 'anular', 'dashboard'):
            return [IsAdminOfColmado()]
        return [IsCajeroOrAdmin()]

    def get_queryset(self):
        qs = Factura.objects.filter(colmado=self.request.user.colmado).select_related(
            'cliente', 'created_by', 'ncf_relacionado', 'venta',
        ).prefetch_related('detalles', 'pagos')

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
        estado = self.request.query_params.get('estado')
        if estado:
            qs = qs.filter(estado=estado)
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

    @action(detail=True, methods=['post'], url_path='anular')
    def anular(self, request, pk=None):
        factura = self.get_object()
        if factura.estado == Factura.ESTADO_ANULADA:
            return Response({'error': 'Esta factura ya está anulada.'}, status=status.HTTP_400_BAD_REQUEST)
        motivo = request.data.get('motivo', '').strip()
        factura.estado = Factura.ESTADO_ANULADA
        factura.motivo_anulacion = motivo
        factura.save(update_fields=['estado', 'motivo_anulacion'])
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'facturacion',
            f'Factura {factura.ncf} anulada. Motivo: {motivo or "no especificado"}',
            objeto_id=factura.pk,
        )
        return Response(FacturaSerializer(factura).data)

    @action(detail=True, methods=['post'], url_path='registrar-pago')
    def registrar_pago(self, request, pk=None):
        factura = self.get_object()
        if factura.estado == Factura.ESTADO_ANULADA:
            return Response({'error': 'No se puede registrar un pago en una factura anulada.'}, status=400)

        serializer = PagoFacturaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pago = PagoFactura.objects.create(factura=factura, **serializer.validated_data)

        monto_pagado = factura.monto_pagado
        if monto_pagado >= factura.total:
            factura.estado = Factura.ESTADO_PAGADA
        elif monto_pagado > 0:
            factura.estado = Factura.ESTADO_PARCIAL
        factura.save(update_fields=['estado'])

        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'facturacion',
            f'Pago RD${pago.monto} ({pago.metodo}) registrado en factura {factura.ncf}',
            objeto_id=factura.pk,
        )
        return Response(FacturaSerializer(factura).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        colmado = request.user.colmado
        hoy = timezone.now().date()

        facturas_activas = Factura.objects.filter(
            colmado=colmado,
        ).exclude(estado=Factura.ESTADO_ANULADA)

        por_tipo = list(
            facturas_activas.values('tipo').annotate(
                cantidad=Count('id'),
                total_monto=Sum('total'),
                total_itbis=Sum('itbis'),
            )
        )

        totales = facturas_activas.aggregate(
            total_facturas=Count('id'),
            total_ventas=Sum('total'),
            total_itbis=Sum('itbis'),
        )

        pendientes = facturas_activas.filter(
            estado__in=[Factura.ESTADO_PENDIENTE, Factura.ESTADO_PARCIAL]
        ).aggregate(
            cantidad=Count('id'),
            total=Sum('total'),
        )

        secuencias = SecuenciaNCF.objects.filter(colmado=colmado, activo=True)
        alertas = []
        for seq in secuencias:
            if seq.agotada:
                alertas.append({'tipo': seq.tipo, 'mensaje': f'Secuencia B{seq.tipo} agotada', 'nivel': 'error'})
            elif seq.vencida:
                alertas.append({'tipo': seq.tipo, 'mensaje': f'Secuencia B{seq.tipo} vencida', 'nivel': 'error'})
            elif seq.proxima_a_agotar:
                alertas.append({
                    'tipo': seq.tipo,
                    'mensaje': f'Secuencia B{seq.tipo} próxima a agotarse ({seq.disponibles} disponibles)',
                    'nivel': 'warning',
                })
            dias = (seq.fecha_vencimiento - hoy).days
            if 0 < dias <= 30 and not seq.vencida:
                alertas.append({
                    'tipo': seq.tipo,
                    'mensaje': f'Secuencia B{seq.tipo} vence en {dias} días ({seq.fecha_vencimiento})',
                    'nivel': 'warning',
                })

        return Response({
            'por_tipo': por_tipo,
            'totales': totales,
            'pendientes': pendientes,
            'alertas': alertas,
        })

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
        ).exclude(estado=Factura.ESTADO_ANULADA)

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
