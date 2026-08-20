from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Usuario, Colmado, AuditoriaLog, LoginAttempt
from .serializers import UsuarioSerializer, UsuarioCreateSerializer, ColmadoSerializer, CustomTokenSerializer, AuditoriaLogSerializer
from .audit import log as audit_log, log_anonimo, get_client_ip, get_user_agent
from apps.dashboard.permissions import IsSuperadmin, IsAdminOrSuperuser, IsAdminOfColmado

# Configuración de bloqueo por intentos fallidos
MAX_INTENTOS_FALLIDOS = 5
BLOQUEO_MINUTOS = 15

# Conjunto cerrado de permisos granulares permitidos en permisos_extra.
PERMISOS_VALIDOS = frozenset({
    # Reportes
    'ver_reportes',
    'exportar_reportes',
    # Ventas
    'ver_ventas',
    'anular_ventas',
    'aplicar_descuentos',
    'eliminar_ventas',
    # Clientes
    'ver_clientes',
    'crear_clientes',
    # Inventario
    'ver_productos',
    'editar_productos',
    'ajustar_inventario',
    'ver_movimientos',
    'crear_movimientos',
    'ver_kardex',
    # Compras
    'ver_compras',
    'crear_compras',
    'aprobar_compras',
    'ver_suplidores',
    'crear_suplidores',
    'ver_recepcion',
    'crear_recepcion',
    # Finanzas / Caja
    'ver_gastos',
    'crear_gastos',
    'ver_caja',
    'cerrar_caja',
    'ver_cuentas_cobrar',
    'ver_cuentas_pagar',
    # Facturación
    'ver_facturacion',
    'crear_facturacion',
    # Devoluciones
    'ver_devoluciones',
    'crear_devoluciones',
    # Precios y promociones
    'cambiar_precios',
    'ver_historial_precios',
    'ver_promociones',
    'crear_promociones',
    # Auditoría y configuración
    'ver_auditoria',
    'exportar_auditoria',
    'ver_configuracion',
    'editar_configuracion',
    # Crédito
    'gestionar_credito_clientes',
})


class CustomTokenView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username', '')
        ip = get_client_ip(request)
        ua = get_user_agent(request)

        # Verificar si el usuario está bloqueado por intentos fallidos
        try:
            usuario = Usuario.objects.get(username=username)
            if usuario.esta_bloqueado:
                minutos_restantes = int((usuario.bloqueado_hasta - timezone.now()).total_seconds() / 60) + 1
                return Response(
                    {'detail': f'Cuenta bloqueada por {minutos_restantes} minuto(s) por múltiples intentos fallidos.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Usuario.DoesNotExist:
            pass

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Login exitoso: resetear contador de intentos
            try:
                u = Usuario.objects.get(username=username)
                u.ultimo_acceso = timezone.now()
                u.intentos_fallidos = 0
                u.bloqueado_hasta = None
                u.save(update_fields=['ultimo_acceso', 'intentos_fallidos', 'bloqueado_hasta'])
                # Auditoría de login exitoso
                audit_log(
                    request, AuditoriaLog.ACCION_LOGIN, 'auth',
                    f'Inicio de sesión exitoso: {username}',
                    objeto_id=u.pk,
                )
            except Usuario.DoesNotExist:
                pass
            LoginAttempt.objects.create(username=username, ip=ip, exitoso=True, user_agent=ua)
        else:
            # Login fallido: registrar intento y posiblemente bloquear
            LoginAttempt.objects.create(username=username, ip=ip, exitoso=False, user_agent=ua)
            log_anonimo(
                request, AuditoriaLog.ACCION_LOGIN_FAIL, 'auth',
                f'Intento de login fallido para: {username}',
                extra={'ip': ip},
            )
            try:
                u = Usuario.objects.get(username=username)
                u.intentos_fallidos += 1
                if u.intentos_fallidos >= MAX_INTENTOS_FALLIDOS:
                    u.bloqueado_hasta = timezone.now() + timedelta(minutes=BLOQUEO_MINUTOS)
                    audit_log(
                        request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
                        f'Usuario {username} bloqueado por {MAX_INTENTOS_FALLIDOS} intentos fallidos',
                        objeto_id=u.pk,
                    )
                u.save(update_fields=['intentos_fallidos', 'bloqueado_hasta'])
            except Usuario.DoesNotExist:
                pass

        return response


class LogoutView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='logout')
    def logout(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        audit_log(
            request, AuditoriaLog.ACCION_LOGOUT, 'auth',
            f'Cierre de sesión: {request.user.username}',
            objeto_id=request.user.pk,
        )
        return Response({'ok': True})


class ColmadoViewSet(viewsets.ModelViewSet):
    serializer_class = ColmadoSerializer
    permission_classes = [IsSuperadmin]
    queryset = Colmado.objects.all().order_by('-creado_en')

    def partial_update(self, request, *args, **kwargs):
        colmado = self.get_object()
        # Hacer merge de config_json en lugar de reemplazarlo
        if 'config_json' in request.data and isinstance(request.data.get('config_json'), dict):
            merged = {**(colmado.config_json or {}), **request.data['config_json']}
            data = {**request.data, 'config_json': merged}
        else:
            data = request.data
        serializer = self.get_serializer(colmado, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='toggle-activo')
    def toggle_activo(self, request, pk=None):
        colmado = self.get_object()
        colmado.activo = not colmado.activo
        colmado.save(update_fields=['activo'])
        return Response({'activo': colmado.activo})


class UsuarioViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if self.request.user.is_superuser:
            qs = Usuario.objects.all().select_related('colmado')
            colmado_id = self.request.query_params.get('colmado')
            if colmado_id:
                qs = qs.filter(colmado_id=colmado_id)
            return qs
        return Usuario.objects.filter(colmado=self.request.user.colmado)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return UsuarioCreateSerializer
        return UsuarioSerializer

    def get_permissions(self):
        if self.action in ('create', 'destroy', 'update', 'partial_update'):
            return [permissions.IsAuthenticated(), IsAdminOfColmado()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        from apps.suscripciones.utils import verificar_limite_plan
        if not self.request.user.is_superuser:
            # El ADMIN crea usuarios de su propio colmado — asignarlo automáticamente
            colmado = self.request.user.colmado
            if colmado:
                verificar_limite_plan(colmado, 'max_usuarios', Usuario)
            usuario = serializer.save(colmado=colmado)
        else:
            # El SUPERADMIN puede especificar el colmado en el payload
            usuario = serializer.save()
        audit_log(
            self.request, AuditoriaLog.ACCION_CREAR, 'usuarios',
            f'Usuario creado: {usuario.username} (rol: {usuario.rol})',
            objeto_id=usuario.pk,
            valor_nuevo={'username': usuario.username, 'rol': usuario.rol},
        )

    def perform_update(self, serializer):
        usuario_antes = self.get_object()
        rol_anterior = usuario_antes.rol
        usuario = serializer.save()
        # Auditar cambio de rol explícitamente
        if usuario.rol != rol_anterior:
            audit_log(
                self.request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
                f'Cambio de rol para {usuario.username}: {rol_anterior} → {usuario.rol}',
                objeto_id=usuario.pk,
                valor_anterior={'rol': rol_anterior},
                valor_nuevo={'rol': usuario.rol},
            )

    @action(detail=True, methods=['post'], url_path='toggle-activo',
            permission_classes=[IsAdminOfColmado])
    def toggle_activo(self, request, pk=None):
        usuario = self.get_object()
        if usuario.is_superuser:
            return Response(
                {'error': 'No puedes desactivar un superusuario.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        estado_anterior = usuario.is_active
        usuario.is_active = not usuario.is_active
        usuario.save(update_fields=['is_active'])
        accion_desc = 'activado' if usuario.is_active else 'desactivado'
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Usuario {usuario.username} {accion_desc}',
            objeto_id=usuario.pk,
            valor_anterior={'is_active': estado_anterior},
            valor_nuevo={'is_active': usuario.is_active},
        )
        return Response({'is_active': usuario.is_active})

    @action(detail=True, methods=['get', 'patch'], url_path='permisos',
            permission_classes=[IsAdminOfColmado])
    def permisos(self, request, pk=None):
        usuario = self.get_object()
        if request.method == 'GET':
            return Response(usuario.permisos_extra)

        if not isinstance(request.data, dict):
            return Response(
                {'error': 'Formato de permisos inválido. Se esperaba un objeto JSON.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        claves_invalidas = set(request.data.keys()) - PERMISOS_VALIDOS
        if claves_invalidas:
            return Response(
                {'error': f'Permisos no reconocidos: {", ".join(sorted(claves_invalidas))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valores_invalidos = {k for k, v in request.data.items() if not isinstance(v, bool)}
        if valores_invalidos:
            return Response(
                {'error': f'Los siguientes permisos deben ser true o false: {", ".join(sorted(valores_invalidos))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        permisos_antes = dict(usuario.permisos_extra)
        usuario.permisos_extra = dict(request.data)
        usuario.save(update_fields=['permisos_extra'])
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Permisos actualizados para {usuario.username}',
            objeto_id=usuario.pk,
            valor_anterior=permisos_antes,
            valor_nuevo=dict(request.data),
        )
        return Response(usuario.permisos_extra)

    @action(detail=True, methods=['post'], url_path='reset-password',
            permission_classes=[IsAdminOfColmado])
    def reset_password(self, request, pk=None):
        usuario = self.get_object()

        if usuario.is_superuser and not request.user.is_superuser:
            return Response(
                {'error': 'No puedes modificar la contraseña de un superusuario.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.is_superuser and usuario.colmado != request.user.colmado:
            return Response(
                {'error': 'Solo puedes gestionar usuarios de tu colmado.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        password = request.data.get('password', '')
        if len(password) < 8:
            return Response(
                {'error': 'La contraseña debe tener al menos 6 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.set_password(password)
        usuario.save(update_fields=['password'])
        audit_log(
            request, AuditoriaLog.ACCION_EDITAR, 'usuarios',
            f'Restablecimiento de contraseña para {usuario.username}',
            objeto_id=usuario.pk,
        )
        return Response({'ok': True})

    @action(detail=False, methods=['get', 'patch'], url_path='colmado')
    def colmado(self, request):
        """Obtener o actualizar datos del colmado del usuario autenticado."""
        colmado = request.user.colmado
        if request.method == 'GET':
            serializer = ColmadoSerializer(colmado)
            return Response(serializer.data)

        if not request.user.is_superuser and request.user.rol != Usuario.ROL_ADMIN:
            return Response(
                {'error': 'Solo el administrador puede modificar la configuración del negocio.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Campos exclusivos del SUPERADMIN — el ADMIN no puede tocarlos
        CAMPOS_SOLO_SUPERADMIN = frozenset({
            'itbis', 'moneda', 'bancos', 'ncf', 'metodos_pago',
            'api', 'licencia', 'correo', 'parametros_sistema', 'tipo_ncf',
        })
        # Campos que el ADMIN puede ver pero no modificar
        CAMPOS_READONLY_ADMIN = frozenset({'nombre', 'rnc', 'ruc', 'direccion', 'telefono'})

        if not request.user.is_superuser:
            config_data = request.data.get('config_json', {}) or {}
            campos_criticos = set(config_data.keys()) & CAMPOS_SOLO_SUPERADMIN
            if campos_criticos:
                return Response(
                    {'error': f'No tienes permiso para modificar: {", ".join(sorted(campos_criticos))}'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            campos_readonly = set(request.data.keys()) & CAMPOS_READONLY_ADMIN
            if campos_readonly:
                return Response(
                    {'error': f'Estos campos son de solo lectura para Administrador: {", ".join(sorted(campos_readonly))}'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        config_antes = dict(colmado.config_json) if colmado.config_json else {}
        # Merge config_json para no perder claves existentes
        data = dict(request.data)
        if 'config_json' in data and isinstance(data.get('config_json'), dict):
            data['config_json'] = {**config_antes, **data['config_json']}
        serializer = ColmadoSerializer(colmado, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            audit_log(
                request, AuditoriaLog.ACCION_CONFIG, 'configuracion',
                f'Configuración del colmado actualizada',
                objeto_id=colmado.pk,
                valor_anterior=config_antes,
                valor_nuevo=colmado.config_json,
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuditoriaLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditoriaLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion', 'usuario__nombre', 'modulo']
    ordering_fields = ['fecha']
    permission_classes = [IsAdminOfColmado]

    def get_queryset(self):
        if self.request.user.is_superuser:
            qs = AuditoriaLog.objects.all().select_related('usuario', 'colmado')
            colmado_id = self.request.query_params.get('colmado')
            if colmado_id:
                qs = qs.filter(colmado_id=colmado_id)
        else:
            qs = AuditoriaLog.objects.filter(colmado=self.request.user.colmado).select_related('usuario')

        accion = self.request.query_params.get('accion')
        modulo = self.request.query_params.get('modulo')
        usuario_id = self.request.query_params.get('usuario')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if accion:
            qs = qs.filter(accion=accion)
        if modulo:
            qs = qs.filter(modulo=modulo)
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        return qs
