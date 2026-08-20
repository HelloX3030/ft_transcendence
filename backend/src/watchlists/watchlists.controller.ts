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
import { watchlistCreateDto, watchlistUpdateDto } from './dto';
import { watchlistMovieDto } from './dto/movie.dto';
import { JwtAccessPayload } from 'src/types';
import { watchlistRoleDto, watchlistUserDto } from './dto/user.dto';
import { WATCHLIST_NAME_MAX_LENGTH } from '@cinemates/shared';

@ApiTags('Watchlists')
@ApiBearerAuth()
@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all watchlists of current user' })
  @ApiResponse({ status: 200, description: 'Watchlists returned successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  findAll(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single watchlist by id' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Watchlist returned successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.findOne(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new watchlist' })
  @ApiResponse({ status: 201, description: 'Watchlist created successfully' })
  @ApiResponse({
    status: 400,
    description: `Name is blank or longer than ${WATCHLIST_NAME_MAX_LENGTH} characters.`,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiBody({
    schema: {
      example: {
        name: 'My Watchlist',
      },
    },
  })
  create(@Body() dto: watchlistCreateDto, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update watchlist' })
  @ApiResponse({ status: 200, description: 'Watchlist updated successfully' })
  @ApiResponse({
    status: 400,
    description: `There is no data to update, or the name is blank or longer than ${WATCHLIST_NAME_MAX_LENGTH} characters.`,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: watchlistUpdateDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete watchlist' })
  @ApiResponse({ status: 200, description: 'Watchlist deleted successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.remove(id, user.sub);
  }

  @Get(':id/movies')
  @ApiOperation({ summary: 'Get movies in watchlist' })
  @ApiResponse({ status: 200, description: 'Movies returned successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  getMovies(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.getMovies(id, user.sub);
  }

  @Post(':id/movies')
  @ApiOperation({ summary: 'Add movie to watchlist' })
  @ApiResponse({ status: 201, description: 'Movie added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 409, description: 'Movie already added.' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  @ApiBody({
    schema: {
      example: {
        tmdbId: 123,
      },
    },
  })
  addMovie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: watchlistMovieDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.addMovie(id, dto, user.sub);
  }

  @Delete(':id/movies/:movieId')
  @ApiOperation({ summary: 'Remove movie from watchlist' })
  @ApiResponse({ status: 200, description: 'Movie removed successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 404, description: 'Movie not found.' })
  removeMovie(
    @Param('id', ParseIntPipe) id: number,
    @Param('movieId', ParseIntPipe) movieId: number,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.removeMovie(id, movieId, user.sub);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get users of watchlist' })
  @ApiResponse({ status: 200, description: 'Users returned successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Watchlists not found.' })
  getUsers(@Param('id', ParseIntPipe) id: number, @Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.getUsers(id, user.sub);
  }

  @Post(':id/users')
  @ApiOperation({ summary: 'Add user to watchlist with role' })
  @ApiResponse({ status: 201, description: 'User added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 404, description: 'Watchlists not found or user not found.' })
  @ApiResponse({ status: 409, description: 'User already added.' })
  @ApiBody({
    schema: {
      example: {
        userId: 42,
        role: 'editor',
      },
    },
  })
  addUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: watchlistUserDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.addUser(id, dto, user.sub);
  }

  @Patch(':id/users/:userId')
  @ApiOperation({ summary: 'Update user role in watchlist' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description: 'You cannot change your role.',
  })
  @ApiResponse({
    status: 403,
    description: 'You have read-only access.',
  })
  @ApiResponse({ status: 404, description: 'Watchlists not found or user not found.' })
  @ApiBody({
    schema: {
      example: {
        role: 'editor',
      },
    },
  })
  updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: watchlistRoleDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.updateUserRole(id, userId, dto, user.sub);
  }

  @Delete(':id/users/:userId')
  @ApiOperation({ summary: 'Remove user from watchlist' })
  @ApiResponse({ status: 200, description: 'User removed successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'You have read-only access.' })
  @ApiResponse({ status: 404, description: 'Watchlist or user not found.' })
  @ApiResponse({
    status: 409,
    description: 'The last editor cannot be removed. Delete the watchlist instead.',
  })
  removeUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.watchlistsService.removeUser(id, userId, user.sub);
  }
}
