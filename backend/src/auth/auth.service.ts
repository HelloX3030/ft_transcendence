import { Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  register(dto: RegisterDto) {}
  login(dto: LoginDto) {
    return dto;
  }
}
