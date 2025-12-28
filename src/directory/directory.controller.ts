// src/directory/directory.controller.ts
import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';

import { DirectoryService } from '@/directory/directory.service';
import { CreateNodeDto } from '@/directory/dto/create-node.dto';
import { DirectoryNode } from '@/directory/entities/directory-node.entity';

@ApiTags('Directory')
@Controller('directory')
// @UseGuards(AuthGuard('jwt'), RolesGuard, HierarchyGuard) // <--- ORDEN CRÍTICO
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) { }

  @Post()
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
  /* 
    @Delete(':id')
    @Roles('OU_ADMIN', 'SUPER_ADMIN') // RBAC: Solo admins pueden borrar
    remove(@Param('id') id: string) {
      // Si llega aquí, es porque:
      // 1. Está logueado.
      // 2. Es Admin.
      // 3. El ID que quiere borrar ESTÁ debajo de él en el árbol.
      return this.directoryService.softDelete(+id);
    }
   */
}