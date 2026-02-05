# 📁 NestJS LDAP Directory Service

Sistema de directorio empresarial híbrido que combina la estructura jerárquica de LDAP con control de acceso basado en roles (RBAC) dinámico.

## 🎯 Características Principales

- **Jerarquía Organizacional:** Estructura tipo LDAP (DC → OU → GROUP → USER)
- **Materialized Path:** Búsquedas jerárquicas ultra‑rápidas
- **RBAC Jerárquico:** Roles con validación por scope organizacional
- **Autenticación OIDC/OAuth2:** Flujo completo con Authorization Code, Refresh Tokens con rotación y RS256.
- **LDAP Gateway:** Acceso vía protocolo LDAP (1389) para aplicaciones legacy.
- **Auditoría Enterprise:** Trazabilidad completa de acciones administrativas y eventos de seguridad.
- **Swagger UI:** Documentación interactiva de API

## 🆕 Últimas Mejoras

- **Security Hardening (OIDC & JWT)**:
  - Migración a **RS256** para el firmado de JWTs usando un par de claves RSA.
  - Implementación de **OIDC Discovery** (`/.well-known/openid-configuration`) y **JWKS** (`/.well-known/jwks.json`).
  - **Rotación de Refresh Tokens**: Almacenamiento en Redis con validación de un solo uso para prevenir ataques de reutilización ("Reuse Detection").
  - **Revocación de Tokens (Blacklisting)**: Endpoint `/auth/logout` que invalida el token de acceso en Redis instantáneamente.
  - Integración de **Helmet** para headers de seguridad HTTP (HSTS, CSP, etc.).
- **LDAP Gateway Avanzado**:
  - Soporte de filtros de búsqueda avanzados (EqualityMatch) y scopes (`base`, `sub`).
  - Refactorización para reducir complejidad y mejorar la mantenibilidad.
  - Auditoría integrada para `LDAP_BIND` y `LDAP_SEARCH`.
- **Suite de Pruebas de Seguridad**:
  - Tests E2E que validan headers de seguridad, revocación de sesiones y protección contra reutilización de tokens.

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+
- PostgreSQL 14+
- Redis (para gestión de tokens y sesiones)
- pnpm (recomendado)

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd nestjs_ldap

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# IMPORTANTE: Configura POSTGRES_*, CACHE_HOST/PORT y JWT_SECRET

# Iniciar servicios (PostgreSQL + Redis)
docker compose up -d

# Iniciar aplicación
pnpm start:dev
```

La aplicación estará disponible en:
- **API:** http://localhost:3200
- **Swagger:** http://localhost:3200/docs
- **LDAP Gateway:** localhost:1389

---

## 📖 Endpoints Destacados

### Autenticación y OIDC
- `POST /auth/login`: Autenticación tradicional.
- `GET /auth/authorize`: Endpoint de autorización OAuth2.
- `POST /auth/token`: intercambio de código por tokens y refresh.
- `GET /auth/userinfo`: Información del usuario autenticado (OIDC compliant).
- `POST /auth/logout`: Revocación de sesión.
- `GET /.well-known/openid-configuration`: Metadatos del proveedor.
- `GET /.well-known/jwks.json`: Claves públicas para validación de tokens.

### Directorio
- `GET /directory/tree`: Obtener árbol completo.
- `POST /directory`: Crear nodo (OU, USER, etc.).
- `PATCH /directory/:id`: Actualizar atributos.
- `POST /directory/move`: Mover ramas del árbol.

---

## 📚 Referencias Técnicas

- **NestJS** – Framework del core
- **TypeORM** – Persistencia PostgreSQL
- **Redis** – Estado de seguridad y cache
- **node:crypto** – Gestión de claves RSA (RS256)
- **ldapjs** – Implementación del gateway LDAP

---

© 2026 Facundo Cachan – Todos los derechos reservados.