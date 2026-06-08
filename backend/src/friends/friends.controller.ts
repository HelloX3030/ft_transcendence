import { Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAccessPayload } from 'src/types';

@Controller('friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'It gets all friends of the current user.' })
  @ApiResponse({ status: 200, description: 'A list with all friends' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getFriends(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.friendsService.getFriends(user);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Creates a new friendship request.' })
  @ApiResponse({
    status: 200,
    description: 'A friendship request with status "pending" was created.',
  })
  @ApiResponse({ status: 400, description: "You can't be friends with yourself." })
  @ApiResponse({ status: 400, description: 'This friendship already exists.' })
  @ApiResponse({ status: 400, description: 'The user ID is invalid.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addFriend(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.friendsService.addFriend(user, id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Update a friendship status to accepted.' })
  @ApiResponse({
    status: 200,
    description: 'Friendship status was updated successfully.',
  })
  @ApiResponse({ status: 400, description: "You can't be friends with yourself." })
  @ApiResponse({ status: 400, description: 'You cannot accept your own friendship request.' })
  @ApiResponse({ status: 400, description: 'This friendship does not exist.' })
  @ApiResponse({ status: 400, description: 'Friendship is already accepted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  acceptFriendship(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.friendsService.acceptFriendship(user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletes a friendship.' })
  @ApiResponse({ status: 200, description: 'friendship deleted' })
  @ApiResponse({ status: 400, description: "You can't be friends with yourself." })
  @ApiResponse({ status: 400, description: 'This friendship does not exist.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteFriend(@Request() req: ExpressRequest, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as JwtAccessPayload;
    return this.friendsService.deleteFriend(user, id);
  }
}
