import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from 'src/app.module';
import { HttpExceptionFilter } from 'src/filter/http-exception.filter';
import { PrismaExceptionFilter } from 'src/filter/prisma-exception.filter';
import { APP_ORIGINS } from 'src/config/origins';

/**
 * Boots the real app with the same pipes, filters and middleware as main.ts.
 *
 * `customize` can swap providers before the module compiles — used to stub out
 * third-party edges (e.g. the TMDB client) so a suite exercises our own HTTP
 * behaviour without reaching the network.
 */
export async function createTestApp(
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });

  const moduleFixture = await (customize ? customize(builder) : builder).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();

  // Same as main.ts: without it `secure: 'auto'` cookies and `req.ip` would
  // behave differently here than in the running app.
  app.set('trust proxy', 1);

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

  await app.init();

  return app;
}
