import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAccessPayload } from 'src/types';
import { ListNotificationsDto } from './dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Keyset-paginated inbox of the current user.' })
  @ApiResponse({ status: 200, description: 'A page of notifications plus the unread count.' })
  @ApiResponse({ status: 400, description: 'Malformed cursor or limit.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  list(@Request() req: ExpressRequest, @Query() query: ListNotificationsDto) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.list(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread notifications, for the badge.' })
  @ApiResponse({ status: 200, description: 'The unread count.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  unreadCount(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.unreadCount(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marks one notification as read.' })
  @ApiResponse({ status: 200, description: 'The refreshed unread count.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markRead(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marks every notification of the current user as read.' })
  @ApiResponse({ status: 200, description: 'The refreshed unread count.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAllRead(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.markAllRead(user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Removes one notification.' })
  @ApiResponse({ status: 200, description: 'The refreshed unread count.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.remove(user.sub, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clears the whole inbox of the current user.' })
  @ApiResponse({ status: 200, description: 'The refreshed unread count.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  clear(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.notifications.clear(user.sub);
  }
}
