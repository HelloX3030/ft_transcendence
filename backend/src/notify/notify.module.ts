import { Module } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { NotifyService } from './notify.service';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [AuthModule, UtilsModule],
  controllers: [],
  providers: [NotifyGateway, NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
