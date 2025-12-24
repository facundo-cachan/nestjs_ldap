import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para obtener el usuario actual desde el request.
 * Uso: @CurrentUser() user: DirectoryNode
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
