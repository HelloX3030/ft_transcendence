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
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { memoryStorage } from 'multer';
import { JwtAccessPayload } from 'src/types';
import { OnboardingDto, SearchUsersDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';
import { ALLOWED_IMAGE_MIMETYPES, otpDto } from 'src/utils';

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

  @Post('me/onboarding')
  @ApiOperation({ summary: 'Complete onboarding for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Updated user profile with onboarding completed' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  completeOnboarding(@Request() req: ExpressRequest, @Body() dto: OnboardingDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.completeOnboarding(user.sub, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload avatar for authenticated user' })
  @ApiResponse({ status: 201, description: 'Updated user profile' })
  @ApiResponse({ status: 400, description: 'No file, or not a PNG/JPEG/WebP image' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      // Cheap early reject on the declared type; the authoritative check is the
      // magic-byte sniff in UsersService.uploadAvatar (mimetype is client-supplied).
      fileFilter: (_req, file, cb) => cb(null, ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)),
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

  @Get('search')
  @ApiOperation({ summary: 'Search users by username' })
  @ApiResponse({ status: 200, description: 'Paginated list of matching public profiles' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  searchUsers(@Request() req: ExpressRequest, @Query() dto: SearchUsersDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.searchUsers(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get a user's public profile" })
  @ApiResponse({ status: 200, description: 'Public user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUser(id);
  }

  @Post('mfa/totp/setup')
  @ApiOperation({ summary: 'Generate TOTP secret for authenticated user' })
  @ApiResponse({
    status: 201,
    description: 'TOTP secret generated successfully. Returns QR code and secret.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'TOTP setup already in progress or active.' })
  createTOTP(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.createTOTP(user.sub);
  }

  @Post('mfa/totp/activate')
  @ApiOperation({ summary: 'Activate TOTP using verification code' })
  @ApiBody({
    schema: {
      example: {
        otp: 213846,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP activated successfully',
  })
  @ApiResponse({ status: 400, description: 'No TOTP set or invalid OTP code' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'TOTP setup already in progress or active.' })
  activateTOTP(@Request() req: ExpressRequest, @Body() dto: otpDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.activateTOTP(user.sub, dto.otp);
  }

  @Delete('mfa/totp')
  @ApiOperation({ summary: 'Disable TOTP for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'TOTP disabled successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteTOTP(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.deleteTOTP(user.sub);
  }
}
