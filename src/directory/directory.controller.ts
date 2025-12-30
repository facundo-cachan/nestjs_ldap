// src/directory/directory.controller.ts
import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, Delete, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { DirectoryService } from '@/directory/directory.service';
import { CreateNodeDto } from '@/directory/dto/create-node.dto';
import { DirectoryNode } from '@/directory/entities/directory-node.entity';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { HierarchyGuard } from '@/auth/guards/hierarchy.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { AuditService } from '@/audit/audit.service';
import { AntiEscalationService } from '@/auth/services/anti-escalation.service';

@ApiTags('Directory')
@Controller('directory')
@UseGuards(JwtAuthGuard, RolesGuard, HierarchyGuard) // ORDEN CRÍTICO: Auth -> Roles -> Hierarchy
@ApiBearerAuth()
export class DirectoryController {
  constructor(
    private readonly directoryService: DirectoryService,
    private readonly auditService: AuditService,
    private readonly antiEscalationService: AntiEscalationService,
  ) { }

  @Post()
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN) // Solo admins pueden crear nodos
  @ApiOperation({ summary: 'Create a new directory node' })
  @ApiBody({ type: CreateNodeDto })
  @ApiResponse({
    status: 201,
    description: 'Node successfully created',
  })
  async create(
    @Body() createNodeDto: CreateNodeDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ): Promise<DirectoryNode> {
    // Validar anti-escalamiento (Fase 4)
    await this.antiEscalationService.validateNodeCreation(user, createNodeDto);

    const node = await this.directoryService.create(createNodeDto);

    // Registrar auditoría para creación de nodos
    await this.auditService.log({
      actorId: user.sub,
      actorName: user.username,
      actorRole: user.role,
      action: 'CREATE',
      targetId: node.id,
      targetName: node.name,
      targetType: node.type,
      scope: user.mpath,
      metadata: {
        parentId: createNodeDto.parentId,
        nodeType: createNodeDto.type,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return node;
  }

  // Ejemplo: GET /directory/scope/5?q=juan
  // Busca a "juan" dentro de la OU con ID 5 y todas sus sub-OUs
  @Get('scope/:rootId')
  @ApiOperation({ summary: 'Search within directory scope' })
  @ApiParam({ name: 'rootId', description: 'Root node ID to search from', type: 'number' })
  @ApiQuery({ name: 'q', description: 'Search query string', required: false })
  @ApiResponse({
    status: 200,
    description: 'Search results',
  })
  searchInScope(
    @Param('rootId', ParseIntPipe) rootId: number,
    @Query('q') query?: string,
  ) {
    return this.directoryService.searchInSubtree(rootId, query);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get full directory tree' })
  @ApiResponse({
    status: 200,
    description: 'Complete directory tree structure',
  })
  getTree() {
    return this.directoryService.getFullTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single directory node by ID' })
  @ApiParam({ name: 'id', description: 'Node ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Directory node details',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - node outside user scope',
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const node = await this.directoryService.findOne(id);

    // Registrar auditoría solo para admins (no para usuarios normales)
    if (user.role === 'SUPER_ADMIN' || user.role === 'OU_ADMIN') {
      await this.auditService.log({
        actorId: user.sub,
        actorName: user.username,
        actorRole: user.role,
        action: 'READ',
        targetId: id,
        targetName: node?.name || 'unknown',
        targetType: node?.type || 'unknown',
        scope: user.mpath,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    return node;
  }

  @Get(':id/ancestors')
  @ApiOperation({ summary: 'Get node ancestors (breadcrumbs)' })
  @ApiParam({ name: 'id', description: 'Node ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Array of ancestor nodes from root to parent',
  })
  getAncestors(@Param('id', ParseIntPipe) id: number) {
    return this.directoryService.getAncestors(id);
  }

  @Get('search/flat')
  @ApiOperation({ summary: 'Flat search across all directory' })
  @ApiQuery({ name: 'q', description: 'Search term', required: true })
  @ApiQuery({ name: 'type', description: 'Node type filter', required: false })
  @ApiResponse({
    status: 200,
    description: 'Search results ignoring hierarchy',
  })
  flatSearch(
    @Query('q') query: string,
    @Query('type') type?: string,
  ) {
    return this.directoryService.flatSearch(query, type as any);
  }

  @Post('move')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN) // Solo admins pueden mover nodos
  @ApiOperation({ summary: 'Move a node to a new parent' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'number' },
        newParentId: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Node moved successfully',
  })
  async moveNode(
    @Body('nodeId', ParseIntPipe) nodeId: number,
    @Body('newParentId', ParseIntPipe) newParentId: number,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // Validar anti-escalamiento (Fase 4)
    await this.antiEscalationService.validateNodeMove(user, nodeId, newParentId);

    const node = await this.directoryService.findOne(nodeId);
    const result = await this.directoryService.moveBranch(nodeId, newParentId);

    // Registrar auditoría para movimiento de nodos
    await this.auditService.log({
      actorId: user.sub,
      actorName: user.username,
      actorRole: user.role,
      action: 'MOVE',
      targetId: nodeId,
      targetName: node?.name || 'unknown',
      targetType: node?.type || 'unknown',
      scope: user.mpath,
      metadata: {
        oldParentId: node?.parent?.id,
        newParentId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Delete(':id')
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN) // Solo admins pueden borrar
  @ApiOperation({ summary: 'Delete a directory node' })
  @ApiParam({ name: 'id', description: 'Node ID to delete', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Node deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions or outside scope',
  })
  @ApiResponse({
    status: 404,
    description: 'Node not found',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // Si llega aquí, es porque:
    // 1. Está logueado (JwtAuthGuard)
    // 2. Es Admin (RolesGuard)
    // 3. El ID que quiere borrar ESTÁ debajo de él en el árbol (HierarchyGuard)
    const node = await this.directoryService.findOne(id);
    if (!node) {
      throw new Error('Node not found');
    }

    // Registrar auditoría para eliminación de nodos
    await this.auditService.log({
      actorId: user.sub,
      actorName: user.username,
      actorRole: user.role,
      action: 'DELETE',
      targetId: id,
      targetName: node.name,
      targetType: node.type,
      scope: user.mpath,
      metadata: {
        parentId: node.parent?.id,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // TODO: Implementar soft delete o hard delete según requerimientos
    return { message: 'Delete functionality to be implemented', nodeId: id };
  }
}