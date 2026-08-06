import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { PrismaExceptionFilter } from './filter/prisma-exception.filter';
import { APP_ORIGINS } from './config/origins';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Caddy is the only thing that can reach this process, and it terminates TLS.
  // Trusting its X-Forwarded-* headers is what lets `req.protocol` see https
  // (so session cookies get `Secure`) and `req.ip` see the real client rather
  // than the proxy's container address, which the throttler and session records
  // both depend on.
  app.set('trust proxy', 1);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
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
    origin: APP_ORIGINS,
    credentials: true,
  });
  app.use(cookieParser());
  const config = new DocumentBuilder()
    .setTitle('Backend API Documentation')
    .setDescription('')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  // 'docs', not 'api': Caddy proxies /api/* to this service with the prefix
  // stripped, so everything backend-side lives under one rule with no rewrite —
  // https://localhost/api/docs reaches /docs here.
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
