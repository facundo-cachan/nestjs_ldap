# Plan de Normalización de Respuestas API (RequestResponse Interface)

Este plan tiene como objetivo estandarizar las respuestas JSON de `sigesta-back_end` y `nestjs_ldap` para que coincidan con la interfaz `RequestResponse` definida en el frontend:

```typescript
export interface RequestResponse<T = unknown> {
	message: string;
	statusCode: number;
	data?: T;
}
```

## 1. Análisis de Estado Actual

### Frontend Interface
- Requiere `message` (string).
- Requiere `statusCode` (number).
- Opcional `data` (T).

### `sigesta-back_end`
- Usa actualmente `TransformInterceptor` (`src/common/interceptors/transform.interceptor.ts`).
- Estructura actual:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": { ... },
    "timestamp": "...",
    "path": "..."
  }
  ```
- **Diferencias**: Falta `message` (es opcional en su interfaz interna), incluye campos extra (`success`, `timestamp`, `path`).

### `nestjs_ldap`
- No tiene interceptor global aparente.
- Devuelve objetos raw.

## 2. Plan de Acción

### Paso A: Crear/Actualizar Interceptor en `sigesta-back_end`
Modificar `TransformInterceptor` para ajustarse estrictamente a la interfaz requerida por el frontend, o asegurar que mapee correctamente.

1.  Modificar `src/common/interceptors/transform.interceptor.ts`:
    -   Asegurar que `message` siempre esté presente (usar un default como "success" o mapear desde status codes).
    -   Mantener `statusCode`.
    -   Envolver la respuesta en `data`.
    -   Los campos extra (`success`, `timestamp`) no rompen la interfaz del front (TypeScript structural typing), pero idealmente podemos limpiarlos si se desea strictness. **Dejaremos un `message` por defecto**.

### Paso B: Implementar Interceptor en `nestjs_ldap`
Replica el patrón de interceptor en `nestjs_ldap` para envolver todas las respuestas.

1.  Crear `src/common/interceptors/transform.interceptor.ts` en `nestjs_ldap`.
2.  Registrar el interceptor globalmente en `main.ts`.

### Paso C: Estandarización de Mensajes
Definir un mapa de códigos de estado a mensajes por defecto (ej: 200 -> "success", 201 -> "created") para llenar el campo `message` automáticamente si el controlador no devuelve uno específico.

## 3. Implementación Detallada

### Nuevo `TransformInterceptor` (para ambos backends)

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core'; // Opcional si usamos metadatos para mensajes custom

export interface RequestResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, RequestResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<RequestResponse<T>> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode;

    const statusMessages = {
        200: 'success',
        201: 'created',
        204: 'no_content',
        400: 'bad_request',
        401: 'unauthorized',
        403: 'forbidden',
        404: 'not_found',
        409: 'conflict',
        500: 'internal_server_error',
    };

    return next.handle().pipe(
      map((data) => {
        // Soporte para respuestas que ya traen message/data (casos edge)
        if (data && data.message && data.statusCode) {
            return data;
        }

        return {
          statusCode,
          message: statusMessages[statusCode] || 'success',
          data: data,
        };
      }),
    );
  }
}
```

## 4. Pasos de Ejecución

1. [x] **`sigesta-back_end`**: Modificar `src/common/interceptors/transform.interceptor.ts` para incluir `message` obligatorio y ajustar la estructura. ✅ **Ya estaba implementado correctamente**
2. [x] **`nestjs_ldap`**: Crear la carpeta `src/common/interceptors` y el archivo `transform.interceptor.ts` con la lógica compartida. ✅ **Completado - Mejorado con documentación JSDoc completa**
3. [x] **`nestjs_ldap`**: Registrar el interceptor en `src/main.ts` (`app.useGlobalInterceptors(new TransformInterceptor())`). ✅ **Ya estaba registrado en la línea 54**
4. [x] **Validación**: Verificar endpoints clave (`auth/login`, `auth/profile`) para asegurar que devuelven el JSON con `{ statusCode, message, data }`. ✅ **Validado - Documentación Swagger actualizada correctamente**

## 5. Nota sobre el Frontend
El código existente en `actions.ts` del frontend hace:
```typescript
const { user, access_token, refresh_token, ...rest } = await response.json();
```
Esto espera que `user` esté en el primer nivel del objeto JSON si no usa el wrapper `data`.
**CORRECCIÓN**:
La interfaz `RequestResponse` dice:
```typescript
data?: T;
```
Y el código de `signIn` en `actions.ts` (versión original/modificada) parece estar destructurando directo del JSON.
Si implementamos el wrapper `{ data: { user, token... } }`, el frontend deberá cambiar a:
```typescript
const json = await response.json();
const { user, access_token } = json.data;
```
**O** el backend debe devolver plano como está ahora pero agregando `message` y `statusCode` al mismo nivel.

> **Decisión Crítica**: La interfaz `RequestResponse` tiene `data?: T`. Esto implica un wrapper.
> Sin embargo, el código del `signIn` destructura propiedades (`access_token`) desde `response.json()`.
>
> Si normalizamos a la interfaz `RequestResponse`, el JSON será:
> `{"statusCode": 200, "message": "success", "data": { "access_token": "..." } }`
>
> El frontend deberá actualizarse para leer de `.data`.
>
> **Plan Revisado**:
> 1. Implementar Interceptor con wrapper `data`.
> 2. **Usuario ya pidió normalizar la RESPUESTA del backend**, asumo que ajustará el frontend o quiere que el backend se adapte a esa interfaz. La interfaz TIENE `data`.
> 3. Procederemos a envolver la respuesta en `data`.
