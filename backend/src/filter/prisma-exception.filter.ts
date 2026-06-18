import {
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        throw new ConflictException('The record already exists');

      case 'P2003':
        throw new ConflictException('Foreign key constraint failed');

      case 'P2025':
        throw new NotFoundException('Record not found');

      default:
        console.error(exception);
        throw new InternalServerErrorException('Database error');
    }
  }
}
