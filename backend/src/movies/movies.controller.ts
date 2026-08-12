import { Body, Controller, Param, ParseIntPipe, Post, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request as ExpressRequest } from 'express';
import { SKIP_AUTH_THROTTLE } from 'src/throttle.config';
import { JwtAccessPayload } from 'src/types';
import { ratingDto } from './dto/rating.dto';
import { MoviesService } from './movies.service';

@ApiTags('Movies')
@ApiBearerAuth()
// Reacting happens once per swipe, so the tight auth window — meant for
// credential endpoints — must not apply. The burst and sustained windows stay.
@SkipThrottle(SKIP_AUTH_THROTTLE)
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post(':tmdbId/rating')
  @ApiOperation({ summary: 'React to a trailer. A reaction is permanent and cannot be changed.' })
  @ApiParam({ name: 'tmdbId', type: Number })
  @ApiBody({ type: ratingDto })
  @ApiResponse({ status: 201, description: 'Reaction recorded successfully' })
  @ApiResponse({ status: 400, description: 'Reaction must be "like" or "dislike".' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 409, description: 'You have already reacted to this movie.' })
  setReaction(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Body() dto: ratingDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.moviesService.setReaction(tmdbId, dto.reaction, user.sub);
  }
}
