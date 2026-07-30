import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

// Mirrors how the global ValidationPipe builds and validates the DTO
// (transform + whitelist + forbidNonWhitelisted, see main.ts).
function validate(body: Record<string, unknown>) {
  return validateSync(plainToInstance(UpdateUserDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdateUserDto', () => {
  it('accepts the writable profile fields', () => {
    expect(
      validate({ username: 'alice', email: 'alice@example.com', language: 'en' }),
    ).toHaveLength(0);
  });

  it('rejects an attempt to set the avatar directly — avatars come from POST /me/avatar', () => {
    expect(validate({ avatarFileId: 7 })).not.toHaveLength(0);
  });
});
