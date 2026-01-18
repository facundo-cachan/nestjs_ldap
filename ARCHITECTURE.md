# Arquitectura de Seguridad y OIDC

## 🎯 Visión General
El sistema implementa un modelo de identidad híbrido que actúa como un **Proveedor de Identidad (IdP) OIDC** moderno y un **Gateway LDAP** para sistemas legados.

## 🧱 Estructura del Módulo de Autenticación
```
src/auth/
├── auth.controller.ts        # Endpoints de Login y Logout
├── oidc.controller.ts        # Discovery, JWKS y UserInfo
├── auth.service.ts           # Lógica de tokens y validación
├── services/
│   ├── oidc-key.service.ts   # Gestión de claves RSA (RS256)
│   ├── anti-escalation.service.ts # Prevención de elevación de privilegios
├── guards/
│   ├── jwt-auth.guard.ts     # Validación básica de JWT
│   ├── jwt-blacklist.guard.ts # Verificación de tokens revocados (Redis)
│   ├── hierarchical-permissions.guard.ts # RBAC basado en Scope
└── strategies/
    ├── jwt.strategy.ts       # Verificación RS256 mediante clave pública
```

## 🔐 Seguridad Avanzada

### 1. Firmado de Tokens (RS256)
A diferencia de los secretos compartidos (HS256), utilizamos **RS256** (RSA Signature con SHA-256).
- **Clave Privada**: Se mantiene segura en el servidor para firmar los tokens.
- **Clave Pública**: Expuesta vía `/.well-known/jwks.json` para que los clientes validen las firmas sin poseer el secreto.

### 2. Gestión de Sesiones y Revocación (Redis)
Utilizamos Redis como almacenamiento de alta velocidad para:
- **Refresh Token Whitelisting**: Solo los refresh tokens almacenados son válidos. Al usarse, se rotan (se borra el viejo, se crea uno nuevo).
- **JWT Blacklisting**: Al hacer logout, el identificador único del token (`jti`) se marca como revocado hasta su expiración natural.

### 3. Endpoints OIDC Standard
- **Discovery**: `/.well-known/openid-configuration` permite la auto-configuración de clientes.
- **UserInfo**: Devuelve claims estándar (`name`, `email`, `preferred_username`) y claims de negocio (`role`, `roles`, `mpath`).

## 📁 Gateway LDAP
El gateway traduce el protocolo LDAP (TCP/1389) a llamadas de nuestro `DirectoryService`.
- **Bind**: Autenticación directa mediante el flujo de validación del sistema.
- **Search**: Mapeo dinámico de filtros LDAP a consultas optimizadas en PostgreSQL mediante **Materialized Path** (`LIKE 'path.%'`).

## 🛡️ Hardening HTTP
- **Helmet**: Implementado globalmente para forzar HSTS, prevenir Clickjacking (X-Frame-Options) y ataques de MIME type (X-Content-Type-Options).
- **CSP**: Content Security Policy básica configurada para proteger el Swagger y la API.

---
© 2026 Facundo Cachan – Documentación Técnica
