from django.db import models
from apps.usuarios.models import Colmado, Usuario


class Cliente(models.Model):
    colmado = models.ForeignKey(Colmado, on_delete=models.CASCADE, related_name='clientes')
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20, blank=True)
    cedula = models.CharField(max_length=20, blank=True)
    limite_credito = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    saldo_deuda = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cliente'

    def __str__(self):
        return self.nombre

    @property
    def credito_disponible(self):
        return self.limite_credito - self.saldo_deuda

    def puede_fiar(self, monto):
        return self.credito_disponible >= monto


class AbonoFiado(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='abonos')
    cajero = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name='abonos')
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    nota = models.TextField(blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'abono_fiado'
        ordering = ['-fecha']

    def __str__(self):
        return f'Abono RD${self.monto} - {self.cliente.nombre}'
