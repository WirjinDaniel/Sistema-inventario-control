from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from .models import BancoCuenta, SesionCaja, Venta, VentaDetalle
from .serializers import BancoCuentaSerializer, SesionCajaSerializer, VentaSerializer, VentaCreateSerializer
from apps.inventario.models import MovimientoInventario
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog


class BancoCuentaViewSet(viewsets.ModelViewSet):
    serializer_class = BancoCuentaSerializer

    def get_queryset(self):
        return BancoCuenta.objects.filter(colmado=self.request.user.colmado, activo=True)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class SesionCajaViewSet(viewsets.ModelViewSet):
    serializer_class = SesionCajaSerializer

    def get_queryset(self):
        return SesionCaja.objects.filter(colmado=self.request.user.colmado).select_related('cajero')

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado, cajero=self.request.user)

    @action(detail=False, methods=['get'], url_path='activa')
    def sesion_activa(self, request):
        try:
            sesion = SesionCaja.objects.get(colmado=request.user.colmado, cajero=request.user, cierre__isnull=True)
            return Response(SesionCajaSerializer(sesion).data)
        except SesionCaja.DoesNotExist:
            return Response({'detail': 'No hay sesión activa.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='cerrar')
    def cerrar(self, request, pk=None):
        sesion = self.get_object()
        if not sesion.esta_abierta:
            return Response({'detail': 'La sesión ya está cerrada.'}, status=status.HTTP_400_BAD_REQUEST)

        efectivo_declarado = request.data.get('efectivo_final_declarado', 0)

        # Calcular efectivo esperado (efectivo inicial + ventas en efectivo)
        ventas_efectivo = sesion.ventas.filter(
            estado=Venta.ESTADO_COMPLETADA,
            metodo_pago=Venta.PAGO_EFECTIVO,
        ).aggregate(total=Sum('total'))['total'] or 0

        efectivo_calculado = sesion.efectivo_inicial + ventas_efectivo

        sesion.cierre = timezone.now()
        sesion.efectivo_final_declarado = efectivo_declarado
        sesion.efectivo_calculado = efectivo_calculado
        sesion.nota_cierre = request.data.get('nota_cierre', '')
        sesion.save()

        audit_log(request, AuditoriaLog.ACCION_CAJA, 'caja',
                  f'Cierre de caja — efectivo declarado RD${efectivo_declarado}, calculado RD${efectivo_calculado}',
                  objeto_id=sesion.pk)
        return Response(SesionCajaSerializer(sesion).data)


class VentaViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch']

    def get_queryset(self):
        return Venta.objects.filter(colmado=self.request.user.colmado).select_related('cajero', 'cliente')

    def get_serializer_class(self):
        if self.action == 'create':
            return VentaCreateSerializer
        return VentaSerializer

    def perform_create(self, serializer):
        venta = serializer.save()
        audit_log(self.request, AuditoriaLog.ACCION_VENTA, 'ventas',
                  f'Venta #{venta.pk} — RD${venta.total} — {venta.metodo_pago}',
                  objeto_id=venta.pk)

    @action(detail=True, methods=['post'], url_path='anular')
    @transaction.atomic
    def anular(self, request, pk=None):
        venta = self.get_object()
        if venta.estado == Venta.ESTADO_ANULADA:
            return Response({'detail': 'La venta ya está anulada.'}, status=status.HTTP_400_BAD_REQUEST)

        motivo = request.data.get('motivo', '')
        if not motivo:
            return Response({'detail': 'Se requiere un motivo para anular.'}, status=status.HTTP_400_BAD_REQUEST)

        # Revertir stock
        for detalle in venta.detalles.all():
            prod = detalle.producto
            prod.stock_actual += detalle.cantidad
            prod.save(update_fields=['stock_actual'])
            MovimientoInventario.objects.create(
                colmado=request.user.colmado,
                producto=prod,
                tipo=MovimientoInventario.TIPO_AJUSTE,
                cantidad=detalle.cantidad,
                usuario=request.user,
                nota=f'Anulación venta #{venta.pk}: {motivo}',
            )

        # Revertir fiado si aplica
        if venta.metodo_pago == Venta.PAGO_FIADO and venta.cliente:
            venta.cliente.saldo_deuda -= venta.total
            venta.cliente.saldo_deuda = max(venta.cliente.saldo_deuda, 0)
            venta.cliente.save(update_fields=['saldo_deuda'])

        venta.estado = Venta.ESTADO_ANULADA
        venta.motivo_anulacion = motivo
        venta.save(update_fields=['estado', 'motivo_anulacion'])

        audit_log(request, AuditoriaLog.ACCION_ANULAR, 'ventas',
                  f'Anulación venta #{venta.pk} — Motivo: {motivo}', objeto_id=venta.pk)
        return Response(VentaSerializer(venta).data)
