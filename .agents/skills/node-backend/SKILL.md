---
name: node-backend
description: Usar al diseñar o modificar APIs, servicios Node.js, lógica de servidor, integraciones, seguridad, manejo de errores o rendimiento backend.
---

# Backend Node.js

1. Revisar AGENTS.md, runtime, arquitectura real, contratos de API y consumidores. Mantener responsabilidades separadas y reutilizar servicios existentes.
2. Validar entradas en las fronteras, autenticar y autorizar en servidor, minimizar privilegios y proteger secretos. No confiar en controles de la UI.
3. Mantener errores específicos y recuperables, códigos coherentes y logs sin secretos ni datos sensibles. No declarar éxito antes de confirmar persistencia.
4. Evitar I/O bloqueante, N+1 y solicitudes redundantes. Acotar concurrencia, tiempos de espera y tamaño de entradas; reintentar sólo operaciones seguras e idempotentes.
5. Conservar transacciones, consistencia, idempotencia y auditoría en operaciones críticas. No introducir capas, librerías ni patrones especulativos.
6. Probar casos normales, límites, errores, permisos y concurrencia; medir rendimiento antes y después si es el objetivo.

## Referencias bajo demanda

- https://github.com/goldbergyoni/nodebestpractices
- https://nodejs.org/docs/latest/api/
- https://cheatsheetseries.owasp.org/

Consultar únicamente la recomendación pertinente y contrastarla con la versión instalada y la documentación oficial.
