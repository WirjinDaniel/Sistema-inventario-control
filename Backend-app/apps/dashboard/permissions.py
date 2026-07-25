from rest_framework import permissions


class IsSuperadmin(permissions.BasePermission):
    """Solo usuarios con is_superuser=True pueden acceder"""
    def has_permission(self, request, view):
        return request.user and request.user.is_superuser


class IsAdminOrSuperuser(permissions.BasePermission):
    """Admin o superuser"""
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)
