import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

export interface RequestResponse<T> {
  statusCode: keyof typeof statusMessages;
  message: string;
  data?: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, RequestResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<RequestResponse<T>> {
    const response = context.switchToHttp().getResponse<ExpressResponse>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        return {
          statusCode,
          message: statusMessages[statusCode] || statusMessages[200],
          data,
        };
      }),
    );
  }
}
