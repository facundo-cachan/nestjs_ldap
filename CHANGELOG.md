# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Security
- **Validación de credenciales en signIn**: Ahora el método `login` en `AuthService` valida tanto la existencia del usuario como su contraseña antes de generar tokens JWT. Esto centraliza la validación de credenciales en el servicio de autenticación, permitiendo que las aplicaciones cliente confíen completamente en el token sin necesidad de validar credenciales nuevamente.
- **Auditoría de intentos de login**: Se registran tanto los intentos exitosos como fallidos de autenticación en el sistema de auditoría para trazabilidad de seguridad.
- **Autenticación por email**: El sistema ahora valida usuarios usando su email en lugar del username para mayor flexibilidad.

### Changed
- Modificado `AuthService.login()` para validar credenciales usando el método `validateUser()` existente antes de generar tokens
- Agregado manejo de errores con `UnauthorizedException` para credenciales inválidas
- Mejorada la documentación JSDoc del método `login()` con ejemplos y descripción de excepciones
- **Normalización de respuestas API**: El endpoint `/auth/login` ahora retorna respuestas en el formato estándar `RequestResponse` con estructura `{ statusCode, message, data }` gracias al `TransformInterceptor` global
- Actualizada documentación de Swagger para reflejar el formato de respuesta normalizado
- **Mejora del TransformInterceptor**: 
  - Agregada documentación JSDoc completa para la interfaz `RequestResponse`, el interceptor y todos sus métodos
  - Implementada lógica para detectar respuestas que ya están en el formato `RequestResponse` (ej: desde exception filters), evitando doble wrapping
  - Cambiado el tipo de `statusCode` de `keyof typeof statusMessages` a `number` para mayor flexibilidad
  - Mejorado el mensaje por defecto usando `'success'` en lugar de `statusMessages[200]`

### Fixed
- **Status code correcto en login**: El endpoint `/auth/login` ahora retorna `200 OK` en lugar de `201 Created`, ya que no se está creando un recurso sino autenticando un usuario existente

## [1.0.0] - 2026-01-19

### Added
- Sistema de directorio empresarial híbrido con estructura jerárquica tipo LDAP
- Materialized Path para búsquedas jerárquicas ultra-rápidas
- RBAC Jerárquico con validación por scope organizacional
- Autenticación OIDC/OAuth2 con Authorization Code Flow
- Refresh Tokens con rotación automática
- LDAP Gateway en puerto 1389 para aplicaciones legacy
- Auditoría Enterprise con trazabilidad completa
- Swagger UI para documentación interactiva de API

### Security
- Migración a RS256 para firmado de JWTs usando par de claves RSA
- Implementación de OIDC Discovery (`/.well-known/openid-configuration`)
- JWKS endpoint (`/.well-known/jwks.json`) para validación de tokens
- Rotación de Refresh Tokens con almacenamiento en Redis
- Revocación de Tokens (Blacklisting) vía endpoint `/auth/logout`
- Integración de Helmet para headers de seguridad HTTP (HSTS, CSP, etc.)
- Suite de pruebas de seguridad E2E

[Unreleased]: https://github.com/facundo-cachan/nestjs_ldap/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/facundo-cachan/nestjs_ldap/releases/tag/v1.0.0
