import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      // transform: true, todo: may be necessary later to convert the data types automatically
    }),
  );
  app.enableCors(); // todo: The domain must be specified here later for better security
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
