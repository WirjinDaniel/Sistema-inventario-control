from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Q
from .models import DevolucionSuplidor
from .serializers import DevolucionSuplidorSerializer, DevolucionSuplidorCreateSerializer
from apps.usuarios.audit import log as audit_log
from apps.usuarios.models import AuditoriaLog
from apps.dashboard.permissions import IsAdminOfColmado


class DevolucionSuplidorViewSet(viewsets.ModelViewSet):
    """Devoluciones a suplidores — solo ADMIN del colmado."""
    http_method_names = ['get', 'post', 'patch']
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        qs = DevolucionSuplidor.objects.filter(
            colmado=self.request.user.colmado
        ).select_related('suplidor', 'usuario', 'orden_compra').prefetch_related('items__producto')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(suplidor__nombre__icontains=search) | Q(motivo__icontains=search))

        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return DevolucionSuplidorCreateSerializer
        return DevolucionSuplidorSerializer

    def create(self, request, *args, **kwargs):
        serializer = DevolucionSuplidorCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        dev = serializer.save()
        audit_log(request, AuditoriaLog.ACCION_COMPRA, 'devoluciones-suplidores',
                  f'Devolución a suplidor #{dev.pk} — {dev.suplidor.nombre} — RD${dev.monto_credito}',
                  objeto_id=dev.pk)
        return Response(DevolucionSuplidorSerializer(dev).data, status=status.HTTP_201_CREATED)
