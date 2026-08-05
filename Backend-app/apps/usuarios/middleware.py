from django.http import JsonResponse


class ColmadoActivoMiddleware:
    """
    Rechaza requests de:
    - Usuarios con is_active=False (aunque tengan token JWT válido).
    - Usuarios cuyo colmado está desactivado.
    El SUPERADMIN queda exento de ambas restricciones de colmado.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.path.startswith('/api/')
            and hasattr(request, 'user')
            and request.user.is_authenticated
        ):
            # Bloquear usuario desactivado (aplica a todos, incluyendo ADMIN)
            if not request.user.is_active:
                return JsonResponse(
                    {'detail': 'Tu cuenta está desactivada. Contacta al administrador.'},
                    status=403,
                )
            # Bloquear si el colmado está suspendido (no aplica a SUPERADMIN)
            if (
                not request.user.is_superuser
                and request.user.colmado is not None
                and not request.user.colmado.activo
            ):
                return JsonResponse(
                    {'detail': 'Este colmado está desactivado. Contacta al administrador.'},
                    status=403,
                )

        return self.get_response(request)
