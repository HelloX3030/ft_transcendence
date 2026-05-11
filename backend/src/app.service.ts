import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getDbTime(): Promise<Date> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const rows = (await this.prisma.$queryRaw`SELECT NOW() as now`) as Array<{ now: Date }>;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return rows[0].now;
  }
}
