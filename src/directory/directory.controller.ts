// src/directory/directory.controller.ts
import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

import { DirectoryService } from '@/directory/directory.service';
import { CreateNodeDto } from '@/directory/dto/create-node.dto';
import { DirectoryNode } from '@/directory/entities/directory-node.entity';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { HierarchyGuard } from '@/auth/guards/hierarchy.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums/role.enum';

@ApiTags('Directory')
@Controller('directory')
@UseGuards(JwtAuthGuard, RolesGuard, HierarchyGuard) // ORDEN CRÍTICO: Auth -> Roles -> Hierarchy
@ApiBearerAuth()
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) { }

  @Post()
  @Roles(Role.OU_ADMIN, Role.SUPER_ADMIN) // Solo admins pueden crear nodos
  @ApiOperation({ summary: 'Create a new directory node' })
  @ApiBody({ type: CreateNodeDto })
  @ApiResponse({
    status: 201,
    description: 'Node successfully created',
  })
  create(@Body() createNodeDto: CreateNodeDto): Promise<DirectoryNode> {
    return this.directoryService.create(createNodeDto);
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.directoryService.findOne(id);
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
  moveNode(
    @Body('nodeId', ParseIntPipe) nodeId: number,
    @Body('newParentId', ParseIntPipe) newParentId: number,
  ) {
    return this.directoryService.moveBranch(nodeId, newParentId);
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
  async remove(@Param('id', ParseIntPipe) id: number) {
    // Si llega aquí, es porque:
    // 1. Está logueado (JwtAuthGuard)
    // 2. Es Admin (RolesGuard)
    // 3. El ID que quiere borrar ESTÁ debajo de él en el árbol (HierarchyGuard)
    const node = await this.directoryService.findOne(id);
    if (!node) {
      throw new Error('Node not found');
    }
    // TODO: Implementar soft delete o hard delete según requerimientos
    return { message: 'Delete functionality to be implemented', nodeId: id };
  }
}