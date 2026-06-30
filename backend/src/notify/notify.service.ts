import { Injectable } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';

@Injectable()
export class NotifyService {
  constructor(private notifyGateway: NotifyGateway) {}

  setUserAsActive() {}

  setUserAsInative() {}

  sendNotify(message: string, userId: number) {
    this.notifyGateway.sendMessage(message, userId);
  }
}
