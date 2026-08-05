from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import SecuenciaNCF, Factura


@admin.register(SecuenciaNCF)
class SecuenciaNCFAdmin(ModelAdmin):
    list_display = ('tipo', 'secuencia_desde', 'secuencia_hasta', 'secuencia_actual', 'fecha_vencimiento', 'activo', 'colmado')
    list_filter = ('tipo', 'activo', 'colmado')
    readonly_fields = ('secuencia_actual',)
    list_editable = ('activo',)


@admin.register(Factura)
class FacturaAdmin(ModelAdmin):
    list_display = ('ncf', 'tipo', 'cliente_nombre', 'itbis', 'total', 'estado', 'fecha')
    list_filter = ('tipo', 'estado', 'colmado')
    search_fields = ('ncf', 'cliente_nombre', 'cliente_rnc')
    readonly_fields = ('ncf', 'fecha', 'colmado')
    date_hierarchy = 'fecha'

    def has_add_permission(self, request):
        return False
