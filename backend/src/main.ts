import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';

async function bootstrap() {
  // rawBody: needed to verify WhatsApp webhook signatures over the exact bytes Meta sent.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(AppConfig);

  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.frontendOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key'],
  });
  app.setGlobalPrefix(config.apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // …and reject requests that send them
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`API ready on http://localhost:${config.port}/${config.apiPrefix}`, 'Bootstrap');
}

bootstrap();
