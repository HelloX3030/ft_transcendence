import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { HttpExceptionFilter } from 'src/filter/http-exception.filter';
import { PrismaExceptionFilter } from 'src/filter/prisma-exception.filter';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  app.use(cookieParser());

  await app.init();

  return app;
}
