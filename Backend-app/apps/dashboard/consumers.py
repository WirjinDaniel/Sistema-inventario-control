import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class DashboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket del dashboard en tiempo real.
    Requiere token JWT válido enviado como query param: ?token=<access_token>
    Solo ADMIN y SUPERADMIN pueden conectarse.
    """

    async def connect(self):
        user = await self._autenticar()
        if user is None:
            await self.close(code=4401)
            return

        if not await self._es_admin(user):
            await self.close(code=4403)
            return

        self.user = user
        self.group_name = f'dashboard_{user.colmado_id or "super"}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def dashboard_update(self, event):
        await self.send(text_data=json.dumps(event['data']))

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _autenticar(self):
        """Extrae y valida el JWT desde el query string. Devuelve Usuario o None."""
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            qs = self.scope.get('query_string', b'').decode()
            params = dict(p.split('=') for p in qs.split('&') if '=' in p)
            token_str = params.get('token', '')
            if not token_str:
                return None
            token = AccessToken(token_str)
            user_id = token.get('user_id')
            if not user_id:
                return None
            return await self._get_usuario(user_id)
        except Exception:
            return None

    @database_sync_to_async
    def _get_usuario(self, user_id):
        from apps.usuarios.models import Usuario
        try:
            return Usuario.objects.select_related('colmado').get(pk=user_id, is_active=True)
        except Usuario.DoesNotExist:
            return None

    @database_sync_to_async
    def _es_admin(self, user):
        from apps.usuarios.models import Usuario
        return user.is_superuser or user.rol == Usuario.ROL_ADMIN
