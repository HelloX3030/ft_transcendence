import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { memoryStorage } from 'multer';
import { JwtAccessPayload } from 'src/types';
import { UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Username already taken' })
  updateMe(@Request() req: ExpressRequest, @Body() dto: UpdateUserDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.updateMe(user.sub, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload avatar for authenticated user' })
  @ApiResponse({ status: 201, description: 'Updated user profile' })
  @ApiResponse({ status: 400, description: 'No file or invalid file type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
    }),
  )
  uploadAvatar(
    @Request() req: ExpressRequest,
    @UploadedFile(new ParseFilePipe({ errorHttpStatusCode: 400 })) file: Express.Multer.File,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.uploadAvatar(user.sub, file);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete authenticated user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteMe(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.deleteMe(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get a user's public profile" })
  @ApiResponse({ status: 200, description: 'Public user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUser(id);
  }
}
