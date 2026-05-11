import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('api/ping')
  async ping() {
    const db_time = await this.appService.getDbTime();
    return { message: 'pong', db_time };
  }
}
