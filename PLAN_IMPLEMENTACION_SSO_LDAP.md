# Plan de Implementación: Evolución SSO y LDAP Universal

Este plan detalla las tareas necesarias para transformar `nestjs_ldap` en un Proveedor de Identidad (IdP) de clase empresarial, garantizando interoperabilidad y compatibilidad con sistemas heredados.

---

## 🛠 Fase 1: Estándares OIDC (Interoperabilidad)
*Objetivo: Permitir que aplicaciones externas se integren usando protocolos web estándar.*

- [ ] **1.1. Estandarización del JWT Payload**
  - Modificar `src/auth/interfaces/jwt-payload.interface.ts` para incluir `iss`, `aud`, `azp` y `nonce`.
  - Actualizar `AuthService.login` para inyectar `ConfigService` y leer el `APP_ISSUER`.
- [ ] **1.2. Endpoints de Descubrimiento**
  - Crear `OidcController` en `src/auth/oidc.controller.ts`.
  - Implementar GET `/.well-known/openid-configuration`.
  - Implementar GET `/auth/jwks.json` (para validación de firma asimétrica en el futuro).
- [ ] **1.3. Endpoint UserInfo**
  - Implementar GET `/auth/userinfo` protegido por JWT que devuelva los "claims" del usuario (email, roles, etc.) según el estándar OIDC.

## 📁 Fase 2: Gateway LDAP (Compatibilidad Legacy)
*Objetivo: Exponer el directorio de usuarios a través del protocolo LDAP (Puerto 389).*

- [ ] **2.1. Infraestructura de Gateway**
  - Instalar `ldapjs` y `@types/ldapjs`.
  - Crear `LdapGatewayModule` y un servicio que levante un servidor LDAP al iniciar la app (`onModuleInit`).
- [ ] **2.2. Implementación de Bind (Auth)**
  - Configurar el handler `server.bind` para validar credenciales delegando en `AuthService.validateUser`.
- [ ] **2.3. Implementación de Search (Read)**
  - Mapear búsquedas LDAP (ej: `(uid=juan)`) a consultas de `DirectoryService.searchInSubtree` o `flatSearch`.
  - Transformar entidades `DirectoryNode` en atributos LDAP estándar (`dn`, `cn`, `sn`, `mail`).

## 🔐 Fase 3: Gestión de Sesión Avanzada
*Objetivo: Control total sobre el ciclo de vida de los usuarios.*

- [ ] **3.1. Refresh Tokens**
  - Crear la entidad `RefreshToken` o integrar Redis para persistencia.
  - Modificar `/auth/login` para devolver `access_token` y `refresh_token`.
  - Crear endpoint POST `/auth/refresh`.
- [ ] **3.2. Single Logout (SLO)**
  - Implementar endpoint POST `/auth/logout`.
  - Crear un interceptor o guard que verifique una "Blacklist" de tokens invalidados.
- [ ] **3.3. Rotación de Secretos**
  - Implementar soporte para múltiples claves JWT para permitir rotación sin cerrar sesiones activas.

---

## 📅 Cronograma Sugerido

| Semana | Actividad | Prioridad |
| :--- | :--- | :--- |
| **1** | Fase 1: Endpoints OIDC y Payloads Estándar | Alta |
| **2** | Fase 3: Refresh Tokens y Logout | Media |
| **3** | Fase 2: Servidor LDAP (ldapjs) - Bind/Search | Baja |

---

## 🚀 Próximos Pasos Inmediatos

1.  **Instalar dependencias:** `npm install ldapjs @types/ldapjs`.
2.  **Actualizar Interfaces:** Refactorizar `JwtPayload`.
3.  **Configuración:** Añadir `ISSUER_URL` y `AUDIENCE` al archivo `.env`.
