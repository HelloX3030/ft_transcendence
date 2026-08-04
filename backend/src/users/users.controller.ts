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
import { disableTotpDto, otpDto } from 'src/utils';
import { FILE_RULES } from '@trailertinder/shared';

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
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  updateMe(@Request() req: ExpressRequest, @Body() dto: UpdateUserDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.updateMe(user.sub, dto);
  }

  @Post('me/onboarding')
  @ApiOperation({ summary: 'Complete onboarding for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Updated user profile with onboarding completed' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Onboarding already completed' })
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
      // Same limits the client checks against, imported from shared so the two
      // cannot drift. This is the backstop: the client's copy is UX only.
      limits: { fileSize: FILE_RULES.avatar.maxBytes },
      // Cheap early reject on the declared type; the authoritative check is the
      // magic-byte sniff in UsersService.uploadAvatar (mimetype is client-supplied).
      fileFilter: (_req, file, cb) =>
        cb(null, (FILE_RULES.avatar.mimes as readonly string[]).includes(file.mimetype)),
    }),
  )
  uploadAvatar(
    @Request() req: ExpressRequest,
    @UploadedFile(new ParseFilePipe({ errorHttpStatusCode: 400 })) file: Express.Multer.File,
  ) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.uploadAvatar(user.sub, file);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: "Delete the authenticated user's avatar" })
  @ApiResponse({ status: 200, description: 'Updated user profile, avatarFileId now null' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No avatar to delete' })
  deleteAvatar(@Request() req: ExpressRequest) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.deleteAvatar(user.sub);
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
    description:
      'TOTP secret generated successfully. Returns the QR code only — the plaintext secret is never sent to the client.',
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
      // Quoted: otpDto.otp is @IsString(), so a JSON number is rejected with a 400.
      example: {
        otp: '213846',
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
  @ApiOperation({
    summary: 'Disable TOTP for authenticated user',
    description:
      'Requires a current, unspent TOTP code while 2FA is active — the access token alone is not enough, or a stolen session could remove the second factor outright. The code is burned on use. An abandoned setup (secret generated, never activated) is cleared without a code.',
  })
  @ApiBody({
    type: disableTotpDto,
    required: false,
    description: 'Omit only when TOTP is not active.',
    examples: { code: { value: { otp: '823641' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP disabled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'TOTP code is missing, invalid, or already spent',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteTOTP(@Request() req: ExpressRequest, @Body() dto: disableTotpDto) {
    const user = req.user as JwtAccessPayload;
    return this.usersService.deleteTOTP(user.sub, dto.otp);
  }
}
