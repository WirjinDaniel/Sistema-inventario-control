from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Promocion


@admin.register(Promocion)
class PromocionAdmin(ModelAdmin):
    list_display = ('nombre', 'tipo', 'valor', 'activo', 'usos', 'fecha_inicio', 'fecha_fin', 'colmado')
    list_filter = ('tipo', 'activo', 'colmado')
    search_fields = ('nombre', 'codigo_cupon')
    list_editable = ('activo',)
    readonly_fields = ('usos', 'creado_en')
    fieldsets = (
        ('General', {'fields': ('colmado', 'nombre', 'descripcion', 'tipo', 'activo')}),
        ('Valor', {'fields': ('valor', 'cantidad_minima', 'cantidad_paga', 'precio_especial', 'codigo_cupon')}),
        ('Alcance', {'fields': ('producto', 'categoria', 'fecha_inicio', 'fecha_fin', 'limite_usos')}),
        ('Estadísticas', {'fields': ('usos', 'creado_en')}),
    )
