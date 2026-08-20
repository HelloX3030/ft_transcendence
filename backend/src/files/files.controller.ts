import { Controller, Delete, Get, Param, ParseIntPipe, Request, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { JwtAccessPayload } from 'src/types';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Stream a stored file' })
  @ApiResponse({ status: 200, description: 'The file bytes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not allowed to read this file' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async read(@Param('id', ParseIntPipe) id: number, @Res() res: ExpressResponse) {
    const file = await this.filesService.read(id);

    res.set({
      // The canonical type sniffed at upload, never the request's or the
      // filename's, both of which are client-controlled.
      'Content-Type': file.mimetype,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      // File ids are immutable: replacing an avatar mints a new id, so these
      // bytes can never change and the browser need only fetch them once.
      // `private` keeps them out of shared caches, since access is per-user.
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    if (file.contentLength !== null) res.set('Content-Length', String(file.contentLength));

    file.body.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a stored file (owner only)' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'File not found' })
  remove(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.filesService.remove(id, user.sub);
  }
}
