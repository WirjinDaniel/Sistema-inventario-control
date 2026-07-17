from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Cliente, AbonoFiado
from .serializers import ClienteSerializer, AbonoFiadoSerializer
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog


class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'telefono', 'cedula']

    def get_queryset(self):
        return Cliente.objects.filter(colmado=self.request.user.colmado, activo=True)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)

    @action(detail=False, methods=['get'], url_path='aging')
    def aging(self, request):
        """
        Aging report de cuentas por cobrar (fiados).
        Agrupa clientes con saldo > 0 por antigüedad del último movimiento.
        Rangos: 0-30, 31-60, 61-90, +90 días.
        """
        hoy = timezone.now().date()
        clientes_con_deuda = Cliente.objects.filter(
            colmado=request.user.colmado,
            activo=True,
            saldo_deuda__gt=0,
        ).prefetch_related('ventas', 'abonos')

        buckets = {
            '0_30':  {'label': '0–30 días',  'clientes': [], 'total': 0},
            '31_60': {'label': '31–60 días', 'clientes': [], 'total': 0},
            '61_90': {'label': '61–90 días', 'clientes': [], 'total': 0},
            '90_mas': {'label': '+90 días',  'clientes': [], 'total': 0},
        }

        for c in clientes_con_deuda:
            # Fecha del movimiento más reciente (venta fiada o abono)
            ultima_venta = c.ventas.filter(
                metodo_pago='FIADO', estado='COMPLETADA'
            ).order_by('-fecha').values_list('fecha', flat=True).first()

            ultimo_abono = c.abonos.order_by('-fecha').values_list('fecha', flat=True).first()

            fechas = [f for f in [ultima_venta, ultimo_abono] if f]
            if fechas:
                ultima_fecha = max(fechas).date() if hasattr(max(fechas), 'date') else max(fechas)
            else:
                ultima_fecha = c.creado_en.date()

            dias = (hoy - ultima_fecha).days
            registro = {
                'id': c.id,
                'nombre': c.nombre,
                'telefono': c.telefono,
                'saldo_deuda': float(c.saldo_deuda),
                'dias': dias,
                'ultima_fecha': str(ultima_fecha),
            }

            if dias <= 30:
                bucket = '0_30'
            elif dias <= 60:
                bucket = '31_60'
            elif dias <= 90:
                bucket = '61_90'
            else:
                bucket = '90_mas'

            buckets[bucket]['clientes'].append(registro)
            buckets[bucket]['total'] += float(c.saldo_deuda)

        total_general = sum(b['total'] for b in buckets.values())
        return Response({'buckets': buckets, 'total': total_general})


class AbonoFiadoViewSet(viewsets.ModelViewSet):
    serializer_class = AbonoFiadoSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        qs = AbonoFiado.objects.filter(cliente__colmado=self.request.user.colmado).select_related('cliente', 'cajero')
        cliente_id = self.request.query_params.get('cliente')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs

    def perform_create(self, serializer):
        abono = serializer.save()
        audit_log(self.request, AuditoriaLog.ACCION_ABONO, 'clientes',
                  f'Abono RD${abono.monto} — {abono.cliente.nombre}', objeto_id=abono.cliente_id)
