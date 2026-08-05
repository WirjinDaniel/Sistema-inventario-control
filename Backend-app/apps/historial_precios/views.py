from rest_framework.mixins import ListModelMixin
from rest_framework.viewsets import GenericViewSet
from .models import HistorialPrecio
from .serializers import HistorialPrecioSerializer
from apps.dashboard.permissions import IsAdminOfColmado


class HistorialPrecioViewSet(ListModelMixin, GenericViewSet):
    """Historial de cambios de precio — solo ADMIN."""
    serializer_class = HistorialPrecioSerializer
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        qs = HistorialPrecio.objects.filter(
            colmado=self.request.user.colmado
        ).select_related('producto', 'usuario')

        producto = self.request.query_params.get('producto')
        if producto:
            qs = qs.filter(producto_id=producto)
        campo = self.request.query_params.get('campo')
        if campo:
            qs = qs.filter(campo=campo)
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs[:200]
