from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from .models import CategoriaGasto, Gasto
from .serializers import CategoriaGastoSerializer, GastoSerializer

CATEGORIAS_PREDEFINIDAS = [
    # (nombre, tipo, icono)
    ('Alquiler del local',        'FIJO',           'home'),
    ('Energía eléctrica',         'FIJO',           'zap'),
    ('Agua',                      'FIJO',           'droplets'),
    ('Internet',                  'FIJO',           'wifi'),
    ('Teléfono',                  'FIJO',           'phone'),
    ('Seguridad / vigilancia',    'FIJO',           'shield'),
    ('Limpieza',                  'FIJO',           'sparkles'),
    ('Sueldos de empleados',      'FIJO',           'users'),
    ('Impuestos y licencias',     'FIJO',           'file-text'),
    ('Transporte / flete',        'VARIABLE',       'truck'),
    ('Fundas, cajas y empaques',  'VARIABLE',       'package'),
    ('Mantenimiento neveras',     'VARIABLE',       'thermometer'),
    ('Reparación de equipos',     'VARIABLE',       'wrench'),
    ('Combustible entregas',      'VARIABLE',       'fuel'),
    ('Publicidad / promociones',  'VARIABLE',       'megaphone'),
    ('Intereses de préstamos',    'FINANCIERO',     'percent'),
    ('Comisiones bancarias',      'FINANCIERO',     'building-2'),
    ('Cargos por POS',            'FINANCIERO',     'credit-card'),
    ('Productos vencidos',        'PERDIDA',        'alert-triangle'),
    ('Productos dañados',         'PERDIDA',        'package-x'),
    ('Mercancía robada',          'PERDIDA',        'shield-off'),
    ('Diferencia de inventario',  'PERDIDA',        'scale'),
    ('Degustación / regalos',     'PERDIDA',        'gift'),
    ('Material de oficina',       'ADMINISTRATIVO', 'pen'),
    ('Tinta para impresora',      'ADMINISTRATIVO', 'printer'),
    ('Papel para facturas',       'ADMINISTRATIVO', 'scroll'),
    ('Software de gestión',       'ADMINISTRATIVO', 'monitor'),
    ('Mantenimiento computadoras','ADMINISTRATIVO', 'cpu'),
    ('Retiro del propietario',    'RETIRO',         'wallet'),
]


class CategoriaGastoViewSet(viewsets.ModelViewSet):
    serializer_class = CategoriaGastoSerializer

    def get_queryset(self):
        return CategoriaGasto.objects.filter(colmado=self.request.user.colmado, activo=True)

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado)

    @action(detail=False, methods=['post'], url_path='seed')
    def seed(self, request):
        colmado = request.user.colmado
        creadas = 0
        for nombre, tipo, icono in CATEGORIAS_PREDEFINIDAS:
            _, created = CategoriaGasto.objects.get_or_create(
                colmado=colmado, nombre=nombre,
                defaults={'tipo': tipo, 'icono': icono, 'predefinida': True},
            )
            if created:
                creadas += 1
        return Response({'creadas': creadas, 'total': len(CATEGORIAS_PREDEFINIDAS)})


class GastoViewSet(viewsets.ModelViewSet):
    serializer_class = GastoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion', 'comprobante']
    ordering_fields = ['fecha', 'monto']

    def get_queryset(self):
        qs = Gasto.objects.filter(colmado=self.request.user.colmado).select_related('categoria', 'usuario')
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(categoria__tipo=tipo)
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs

    def perform_create(self, serializer):
        serializer.save(colmado=self.request.user.colmado, usuario=self.request.user)

    @action(detail=False, methods=['get'], url_path='resumen')
    def resumen(self, request):
        qs = self.get_queryset()
        resumen = {}
        for tipo, _ in CategoriaGasto.TIPOS:
            total = qs.filter(categoria__tipo=tipo).aggregate(t=Sum('monto'))['t'] or 0
            resumen[tipo] = float(total)
        resumen['TOTAL'] = sum(resumen.values())
        return Response(resumen)
