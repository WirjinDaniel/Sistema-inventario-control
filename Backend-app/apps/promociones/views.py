from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from .models import Promocion
from .serializers import PromocionSerializer
from apps.dashboard.permissions import IsAdminOfColmado, IsCajeroOrAdmin


class PromocionViewSet(viewsets.ModelViewSet):
    """
    Promociones:
    - Administrar (crear/editar/eliminar): solo ADMIN.
    - Consultar / buscar cupón: CAJERO y ADMIN (el cajero aplica cupones en el POS).
    """
    serializer_class = PromocionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'por_cupon', 'usar'):
            return [IsCajeroOrAdmin()]
        return [IsAdminOfColmado()]

    def get_queryset(self):
        qs = Promocion.objects.filter(
            colmado=self.request.user.colmado
        ).select_related('producto', 'categoria')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(nombre__icontains=search) | Q(codigo_cupon__icontains=search))

        activo = self.request.query_params.get('activo')
        if activo == 'true':
            hoy = timezone.now().date()
            qs = qs.filter(activo=True).filter(
                Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy)
            )
        elif activo == 'false':
            hoy = timezone.now().date()
            qs = qs.filter(Q(activo=False) | Q(fecha_fin__lt=hoy))

        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)

    @action(detail=False, methods=['get'], url_path='por-cupon')
    def por_cupon(self, request):
        codigo = request.query_params.get('codigo', '').upper()
        if not codigo:
            return Response({'detail': 'Código requerido.'}, status=400)
        hoy = timezone.now().date()
        promo = Promocion.objects.filter(
            colmado=request.user.colmado,
            tipo=Promocion.TIPO_CUPON,
            codigo_cupon__iexact=codigo,
            activo=True,
        ).filter(
            Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=hoy)
        ).filter(
            Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy)
        ).first()

        if not promo:
            return Response({'detail': 'Cupón no válido o expirado.'}, status=404)
        if promo.limite_usos and promo.usos >= promo.limite_usos:
            return Response({'detail': 'Cupón agotado.'}, status=400)
        return Response(PromocionSerializer(promo).data)

    @action(detail=True, methods=['post'], url_path='usar')
    def usar(self, request, pk=None):
        promo = self.get_object()
        promo.usos += 1
        promo.save(update_fields=['usos'])
        return Response({'usos': promo.usos})
