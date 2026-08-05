from rest_framework import permissions


class IsSuperadmin(permissions.BasePermission):
    """Solo el propietario de la plataforma (is_superuser=True)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class IsAdminOrSuperuser(permissions.BasePermission):
    """ADMIN del colmado o SUPERADMIN. Usa el campo `rol`, no is_staff."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        from apps.usuarios.models import Usuario
        return request.user.is_superuser or request.user.rol == Usuario.ROL_ADMIN


class IsAdminOfColmado(permissions.BasePermission):
    """
    ADMIN del colmado propio o SUPERADMIN.
    - has_permission: verifica rol.
    - has_object_permission: verifica además que el objeto pertenezca al mismo colmado.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        from apps.usuarios.models import Usuario
        return request.user.is_superuser or request.user.rol == Usuario.ROL_ADMIN

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        colmado = getattr(obj, 'colmado', None)
        return colmado is not None and colmado == request.user.colmado


class IsCajeroOrAdmin(permissions.BasePermission):
    """CAJERO, ADMIN del colmado o SUPERADMIN. Para operaciones de venta y caja."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        from apps.usuarios.models import Usuario
        return request.user.is_superuser or request.user.rol in (
            Usuario.ROL_CAJERO, Usuario.ROL_ADMIN
        )


class IsInventarioOrAdmin(permissions.BasePermission):
    """INVENTARIO, ADMIN del colmado o SUPERADMIN. Para gestión de productos e inventario."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        from apps.usuarios.models import Usuario
        return request.user.is_superuser or request.user.rol in (
            Usuario.ROL_INVENTARIO, Usuario.ROL_ADMIN
        )
