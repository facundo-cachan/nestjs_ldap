# Reporte: Evaluación de Funcionalidad SSO y Capacidades LDAP (Contexto: nestjs_ldap)

**Fecha:** 2026-01-18  
**Proyecto Analizado:** `nestjs_ldap` (IdP / Servidor de Directorio)
**Estado:** Análisis técnico de capacidades IdP y propuesta de evolución

---

## 1. 🔍 Análisis de nestjs_ldap como SSO

Tras analizar el núcleo de `nestjs_ldap`, se concluye que el proyecto está diseñado para ser el **Corazón de Identidad (Identity Provider)** de un ecosistema.

### ¿Cómo funciona actualmente como SSO?
El proyecto ya implementa las bases de un SSO interno:
- **Generación de JWT Enriquecidos:** El `AuthService.login` genera tokens que cargan no solo la identidad (`sub`, `id`), sino también el contexto de autorización jerárquico (`mpath`, `adminOfNodeId`, `roles`).
- **Validación de Scope:** El `mpath` (Materialized Path) en el token es la pieza clave que permite que otros servicios (como `sigesta`) validen permisos sin consultar la base de datos central en cada request.
- **Hierarchical RBAC:** El sistema de roles (`SUPER_ADMIN`, `OU_ADMIN`, `USER`) está preparado para delegar autoridad de forma granular a través de múltiples aplicaciones.

### Fortalezas de nestjs_ldap:
1.  **Dinamismo:** El uso de `attributes` (JSONB en Postgres) emula la flexibilidad de un esquema LDAP sin la rigidez de una base de datos relacional tradicional.
2.  **Eficiencia:** El `Materialized Path` es la mejor práctica para búsquedas en árboles, permitiendo que el SSO maneje estructuras organizacionales de gran escala.

---

## 2. 🏗️ Propuesta de Mejora: Hacia un SSO/LDAP Universal

Para que `nestjs_ldap` sea un servidor de identidades completo, se sugieren las siguientes líneas de trabajo:

### A. Implementación de Protocolos Estándar (Interoperabilidad)
Actualmente, el SSO es "privado". Para permitir que aplicaciones de terceros (Cloud, CRM, legacy) se integren, se recomienda:
1.  **Exposición de OIDC (OpenID Connect):**
    - Implementar los endpoints de descubrimiento: `/.well-known/openid-configuration`.
    - Eviar payloads JWT que sigan el estándar (incluyendo `iss`, `aud`, y `azp`).
2.  **Bearer Token Standard:** Asegurar que el payload `JwtPayload` en `src/auth/interfaces/jwt-payload.interface.ts` sea agnóstico a la aplicación consumidora.

### B. Funciones de LDAP Reales (Protocol Interface)
`nestjs_ldap` habla HTTP, pero los sistemas tradicionales hablan el protocolo LDAP (TCP 389).
- **Sugerencia:** Integrar `ldapjs` para actuar como un **LDAP-over-PostgreSQL Gateway**. Esto permitiría que el mismo usuario de la base de datos pueda loguearse en una VPN de red usando el protocolo LDAP estándar.

### C. Consolidación de la Verdad (Centralización)
- **Single Logout (SLO):** Implementar una lista de revocación (Redist o DB) para invalidar tokens de forma centralizada.
- **Gestión de Sesiones (Refresh Tokens):** El sistema actual parece emitir tokens de 1 hora. Se sugiere un mecanismo de rotación de Refresh Tokens para mantener la sesión del SSO viva de forma segura.

---

## 3. 💻 Sugerencias Técnicas para nestjs_ldap

### 1. Estandarización del Payload (`jwt-payload.interface.ts`)
Se recomienda añadir campos de "Audience" y "Issuer" dinámicos para soportar múltiples aplicaciones:
```typescript
export interface JwtPayload {
  sub: string;           
  iss: string;           // Identificador de nestjs_ldap como emisor
  aud: string | string[]; // Aplicación/es que pueden usar este token
  iat: number;
  exp: number;
  // ... campos actuales (mpath, roles)
}
```

### 2. Endpoint de Perfil Centralizado
Modificar `auth.controller.ts` para incluir un endpoint `/auth/userinfo` (estándar OIDC) que devuelva todos los claims del usuario autenticado, permitiendo que aplicaciones "satélite" refresquen el perfil del usuario bajo demanda.

---

## 📝 Conclusión

**nestjs_ldap** ya es un IdP funcional para un entorno de microservicios controlados. Su arquitectura basada en árboles es su mayor activo. La evolución lógica es convertirlo de un "almacén de usuarios con JWT" a un **Servidor de Identidad Universal** que soporte tanto protocolos modernos (OIDC) como heredados (LDAP real).
