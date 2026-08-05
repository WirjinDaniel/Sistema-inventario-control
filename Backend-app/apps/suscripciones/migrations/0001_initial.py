import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('usuarios', '0003_usuario_permisos_extra'),
    ]

    operations = [
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('precio_mensual', models.DecimalField(decimal_places=2, max_digits=10)),
                ('max_usuarios', models.PositiveIntegerField(default=5)),
                ('max_productos', models.PositiveIntegerField(default=500)),
                ('descripcion', models.TextField(blank=True)),
                ('activo', models.BooleanField(default=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'plan',
                'ordering': ['precio_mensual'],
            },
        ),
        migrations.CreateModel(
            name='Suscripcion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_inicio', models.DateField()),
                ('fecha_vencimiento', models.DateField()),
                ('estado', models.CharField(
                    choices=[
                        ('ACTIVA', 'Activa'),
                        ('PENDIENTE', 'Pendiente'),
                        ('VENCIDA', 'Vencida'),
                        ('SUSPENDIDA', 'Suspendida'),
                        ('CANCELADA', 'Cancelada'),
                    ],
                    default='ACTIVA',
                    max_length=15,
                )),
                ('precio_pagado', models.DecimalField(decimal_places=2, max_digits=10)),
                ('nota', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('colmado', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='suscripcion',
                    to='usuarios.colmado',
                )),
                ('plan', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='suscripciones',
                    to='suscripciones.plan',
                )),
            ],
            options={
                'db_table': 'suscripcion',
                'ordering': ['-creado_en'],
            },
        ),
        migrations.CreateModel(
            name='PagoSuscripcion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('monto', models.DecimalField(decimal_places=2, max_digits=10)),
                ('fecha', models.DateField()),
                ('metodo', models.CharField(
                    choices=[
                        ('EFECTIVO', 'Efectivo'),
                        ('TRANSFERENCIA', 'Transferencia bancaria'),
                        ('TARJETA', 'Tarjeta'),
                        ('OTRO', 'Otro'),
                    ],
                    max_length=20,
                )),
                ('referencia', models.CharField(blank=True, max_length=100)),
                ('nota', models.TextField(blank=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('suscripcion', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pagos',
                    to='suscripciones.suscripcion',
                )),
                ('registrado_por', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='pagos_suscripcion',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'pago_suscripcion',
                'ordering': ['-fecha'],
            },
        ),
    ]
