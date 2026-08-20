from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum
from .models import BancoCuenta, SesionCaja, Venta, VentaDetalle
from .serializers import BancoCuentaSerializer, SesionCajaSerializer, VentaSerializer, VentaCreateSerializer
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado, IsCajeroOrAdmin


class BancoCuentaViewSet(viewsets.ModelViewSet):
    """Cuentas bancarias del colmado — solo ADMIN puede administrarlas."""
    serializer_class = BancoCuentaSerializer
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        return BancoCuenta.objects.filter(colmado=self.request.user.colmado, activo=True)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)


class SesionCajaViewSet(viewsets.ModelViewSet):
    """Sesiones de caja — CAJERO y ADMIN pueden gestionar sus sesiones."""
    serializer_class = SesionCajaSerializer
    permission_classes = [IsCajeroOrAdmin]

    def get_queryset(self):
        return SesionCaja.objects.filter(colmado=self.request.user.colmado).select_related('cajero')

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado, cajero=self.request.user)

    @action(detail=False, methods=['get'], url_path='activa')
    def sesion_activa(self, request):
        sesion = SesionCaja.objects.filter(colmado=request.user.colmado, cajero=request.user, cierre__isnull=True).first()
        if sesion is None:
            return Response({'detail': 'No hay sesión activa.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SesionCajaSerializer(sesion).data)

    @action(detail=True, methods=['post'], url_path='cerrar')
    def cerrar(self, request, pk=None):
        sesion = self.get_object()
        if not sesion.esta_abierta:
            return Response({'detail': 'La sesión ya está cerrada.'}, status=status.HTTP_400_BAD_REQUEST)

        from decimal import Decimal
        efectivo_declarado = Decimal(str(request.data.get('efectivo_final_declarado', 0)))

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
    """
    Ventas:
    - Registrar / consultar: CAJERO o ADMIN.
    - Anular: solo ADMIN (acción destructiva con impacto en inventario y fiados).
    """
    http_method_names = ['get', 'post', 'patch']

    def get_permissions(self):
        if self.action == 'anular':
            return [IsAdminOfColmado()]
        return [IsCajeroOrAdmin()]

    def get_queryset(self):
        return Venta.objects.filter(colmado=self.request.user.colmado).select_related('cajero', 'cliente')

    def get_serializer_class(self):
        if self.action == 'create':
            return VentaCreateSerializer
        return VentaSerializer

    def create(self, request, *args, **kwargs):
        serializer = VentaCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        venta = serializer.save()
        audit_log(request, AuditoriaLog.ACCION_VENTA, 'ventas',
                  f'Venta #{venta.pk} — RD${venta.total} — {venta.metodo_pago}',
                  objeto_id=venta.pk)
        return Response(VentaSerializer(venta, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='anular')
    def anular(self, request, pk=None):
        from .services import anular_venta
        venta = self.get_object()
        motivo = request.data.get('motivo', '')
        try:
            venta = anular_venta(venta, motivo, request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        audit_log(request, AuditoriaLog.ACCION_ANULAR, 'ventas',
                  f'Anulación venta #{venta.pk} — Motivo: {motivo}', objeto_id=venta.pk)
        return Response(VentaSerializer(venta).data)
