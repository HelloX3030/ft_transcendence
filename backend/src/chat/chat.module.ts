import { forwardRef, Module } from '@nestjs/common';
import { NotifyModule } from 'src/notify/notify.module';
import { UtilsModule } from 'src/utils/utils.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

// The gateway needs ChatService to persist a send, and ChatService needs
// NotifyService to push the read receipt — same forwardRef pairing the notify
// gateway and service already use.
@Module({
  imports: [forwardRef(() => NotifyModule), UtilsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
