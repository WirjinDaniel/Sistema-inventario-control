from django.http import JsonResponse


class ColmadoActivoMiddleware:
    """
    Rechaza requests de:
    - Usuarios con is_active=False (aunque tengan token JWT válido).
    - Usuarios cuyo colmado está desactivado.
    El SUPERADMIN queda exento de ambas restricciones de colmado.

    Los tokens JWT son autenticados por DRF en las vistas, no por el
    AuthenticationMiddleware de Django. Por eso este middleware resuelve
    el usuario manualmente desde el token cuando request.user es anónimo.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def _resolver_usuario_jwt(self, request):
        """Intenta extraer el usuario desde el Bearer token sin pasar por DRF."""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        token_str = auth_header.split(' ', 1)[1]
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.usuarios.models import Usuario
            token = AccessToken(token_str)
            user_id = token.get('user_id')
            if user_id is None:
                return None
            return Usuario.objects.select_related('colmado').get(pk=user_id)
        except Exception:
            return None

    def __call__(self, request):
        if request.path.startswith('/api/'):
            # DRF autentica JWT en la vista, no en middleware.
            # Resolvemos el usuario aquí para poder validar su estado.
            user = request.user if request.user.is_authenticated else self._resolver_usuario_jwt(request)

            if user is not None:
                if not user.is_active:
                    return JsonResponse(
                        {'detail': 'Tu cuenta está desactivada. Contacta al administrador.'},
                        status=403,
                    )
                if (
                    not user.is_superuser
                    and user.colmado is not None
                    and not user.colmado.activo
                ):
                    return JsonResponse(
                        {'detail': 'Este colmado está desactivado. Contacta al administrador.'},
                        status=403,
                    )

        return self.get_response(request)
