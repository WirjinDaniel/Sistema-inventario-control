from rest_framework.exceptions import PermissionDenied


def verificar_limite_plan(colmado, campo, modelo):
    """
    Verifica que el colmado no haya superado el límite definido en su suscripción.
    Los límites (max_productos, max_usuarios) son personalizados por colmado.
    Si no tiene suscripción activa, no aplica restricción.
    """
    from .models import Suscripcion
    try:
        sub = Suscripcion.objects.get(colmado=colmado)
        if not sub.esta_activa:
            return
        limite = getattr(sub, campo, None)
        if limite is None:
            return
        es_usuario = campo == 'max_usuarios'
        if es_usuario:
            actual = modelo.objects.filter(colmado=colmado, is_active=True).count()
        else:
            actual = modelo.objects.filter(colmado=colmado, activo=True).count()
        if actual >= limite:
            tipo = 'usuarios' if es_usuario else 'productos'
            raise PermissionDenied(
                f'Tu suscripción permite máximo {limite} {tipo}. '
                f'Contacta al administrador para aumentar tu capacidad.'
            )
    except Suscripcion.DoesNotExist:
        pass
