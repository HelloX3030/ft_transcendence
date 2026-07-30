import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAccessPayload } from 'src/types';
import { ChatService } from './chat.service';
import { ListMessagesDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'One entry per friend with a preview and unread count.' })
  @ApiResponse({ status: 200, description: 'The conversation list, most recent first.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getConversations(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.chat.getConversations(user.sub);
  }

  @Get(':peerId/messages')
  @ApiOperation({ summary: 'Keyset-paginated history of one conversation.' })
  @ApiResponse({ status: 200, description: 'A page of messages, oldest first.' })
  @ApiResponse({ status: 400, description: 'Malformed cursor or limit.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMessages(
    @Request() req: ExpressRequest,
    @Param('peerId', ParseIntPipe) peerId: number,
    @Query() query: ListMessagesDto,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.chat.getMessages(user.sub, peerId, query);
  }

  @Post(':peerId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marks everything the peer sent in this conversation as read.' })
  @ApiResponse({ status: 200, description: 'How many messages were marked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markRead(@Request() req: ExpressRequest, @Param('peerId', ParseIntPipe) peerId: number) {
    const user = req.user as JwtAccessPayload;
    return this.chat.markRead(user.sub, peerId);
  }
}
