from django.db.models.signals import pre_save
from django.dispatch import receiver
from apps.inventario.models import Producto

CAMPOS_PRECIO = ['precio_venta', 'precio_costo', 'precio_oferta']


@receiver(pre_save, sender=Producto)
def registrar_cambio_precio(sender, instance, **kwargs):
    if not instance.pk:
        return  # Producto nuevo, sin historial

    try:
        anterior = Producto.objects.get(pk=instance.pk)
    except Producto.DoesNotExist:
        return

    from .models import HistorialPrecio

    usuario = getattr(instance, '_usuario_cambio', None)
    colmado = getattr(instance, 'colmado', None)
    if not colmado:
        return

    for campo in CAMPOS_PRECIO:
        val_ant = getattr(anterior, campo)
        val_nuevo = getattr(instance, campo)
        if val_ant != val_nuevo and val_nuevo is not None:
            HistorialPrecio.objects.create(
                colmado=colmado,
                producto=instance,
                campo=campo,
                valor_anterior=val_ant or 0,
                valor_nuevo=val_nuevo,
                usuario=usuario,
            )
