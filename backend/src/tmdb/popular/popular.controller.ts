import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedMovies } from '../tmdb.types';
import { PopularService } from './popular.service';

@ApiTags('tmdb')
@Controller('tmdb/popular')
export class PopularController {
  constructor(private readonly popularService: PopularService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false })
  fetchPopular(@Query() dto: PaginationQueryDto): Promise<PaginatedMovies> {
    return this.popularService.fetchPopular(dto.page);
  }
}
