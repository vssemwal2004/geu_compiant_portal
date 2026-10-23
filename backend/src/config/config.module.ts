import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.validation';
import { AppConfig } from './app-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: envSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
