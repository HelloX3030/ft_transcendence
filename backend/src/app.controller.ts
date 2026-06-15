import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public() // todo: remove during production
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Public() // todo: remove during production
  @Get('api/ping')
  async ping() {
    const db_time = await this.appService.getDbTime();
    return { message: 'pong', db_time };
  }
}
