import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Mapeo de códigos de estado HTTP a mensajes descriptivos
 */
const statusMessages: { [key: number]: string } = {
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

/**
 * Interface para estandarizar las respuestas de la API
 * @description Define la estructura estándar de todas las respuestas HTTP
 */
export interface RequestResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
}

/**
 * Interceptor global para transformar todas las respuestas al formato RequestResponse
 * @description Envuelve todas las respuestas exitosas en un formato consistente con statusCode, message y data
 * @example
 * // Antes: { user: {...}, token: "..." }
 * // Después: { statusCode: 200, message: "success", data: { user: {...}, token: "..." } }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, RequestResponse<T>> {
  /**
   * Intercepta y transforma la respuesta del controlador
   * @param context - Contexto de ejecución de NestJS
   * @param next - Handler para continuar con la ejecución
   * @returns Observable con la respuesta transformada
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<RequestResponse<T>> {
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // Si la data ya está en el formato correcto (ej: desde un exception filter o retorno manual), retornarla tal cual
        if (data && typeof data === 'object' && 'statusCode' in data && 'message' in data) {
          return data as RequestResponse<T>;
        }

        // Transformar la respuesta al formato estándar
        return {
          statusCode,
          message: statusMessages[statusCode] || 'success',
          data: data,
        };
      }),
    );
  }
}
