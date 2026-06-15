import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { WatchlistsService } from './watchlists.service';
import type { Request as ExpressRequest } from 'express';
import { JwtAccessPayload } from 'src/types';
import { watchlistCreateDto } from './dto';
@ApiTags('Watchlists')
@ApiBearerAuth()
@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  // -------------------------
  // WATCHLIST
  // -------------------------

  @Get()
  @ApiOperation({ summary: 'Get all watchlists of current user' })
  findAll(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single watchlist by id' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.findOne(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new watchlist' })
  @ApiBody({
    schema: {
      example: {
        name: 'My Watchlist',
        image: 'https://example.com/image.jpg',
      },
    },
  })
  create(@Body() dto: watchlistCreateDto, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update watchlist' })
  @ApiResponse({ status: 403, description: 'Invalid watchlist' })
  @ApiResponse({ status: 403, description: 'You have read-only access' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete watchlist' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.remove(id, user.sub);
  }
}
