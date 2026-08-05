from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Q
from .models import Devolucion
from .serializers import DevolucionSerializer, DevolucionCreateSerializer
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado


class DevolucionViewSet(viewsets.ModelViewSet):
    """Devoluciones a clientes — solo ADMIN (impacto financiero y de inventario)."""
    http_method_names = ['get', 'post']
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        qs = Devolucion.objects.filter(
            colmado=self.request.user.colmado
        ).select_related('cajero', 'cliente', 'venta').prefetch_related('items__venta_item__producto')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(cliente__nombre__icontains=search) |
                Q(venta__id__icontains=search) |
                Q(motivo__icontains=search)
            )
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return DevolucionCreateSerializer
        return DevolucionSerializer

    def create(self, request, *args, **kwargs):
        serializer = DevolucionCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        dev = serializer.save()
        audit_log(request, AuditoriaLog.ACCION_AJUSTE, 'devoluciones',
                  f'Devolución #{dev.pk} — Venta #{dev.venta_id} — RD${dev.monto_devuelto}',
                  objeto_id=dev.pk)
        return Response(DevolucionSerializer(dev).data, status=status.HTTP_201_CREATED)
