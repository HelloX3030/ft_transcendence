import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service'

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getDbTime(): Promise<Date> {
    const rows = await this.prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`
    return rows[0].now
  }
}
