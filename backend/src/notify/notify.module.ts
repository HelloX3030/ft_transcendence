import { forwardRef, Module } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ChatModule } from 'src/chat/chat.module';
import { NotifyService } from './notify.service';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [AuthModule, UtilsModule, forwardRef(() => ChatModule)],
  controllers: [],
  providers: [NotifyGateway, NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
