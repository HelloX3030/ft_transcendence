import {
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2000':
        throw new BadRequestException('Provided value for the column is too long.');

      case 'P2002':
        throw new ConflictException('The record already exists');

      case 'P2003':
        throw new ConflictException('Foreign key constraint failed');

      case 'P2025':
        throw new NotFoundException('Record not found');

      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`, exception);
        throw new InternalServerErrorException('Database error');
    }
  }
}
