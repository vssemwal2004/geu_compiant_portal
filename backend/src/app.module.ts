import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { AppConfig } from './config/app-config.service';
import { AuthModule } from './auth/auth.module';
import { RolesGuard, SessionAuthGuard } from './auth/guards';
import { AssetTypesModule } from './asset-types/asset-types.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health/health.controller';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RoutingModule } from './routing/routing.module';
import { StorageModule } from './storage/storage.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.mongo.uri,
        dbName: config.mongo.dbName,
        // Indexes (unique / partial / TTL) are part of the business rules, so build them on start.
        autoIndex: true,
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [{ ttl: 60_000, limit: config.rateLimit.perMinute }],
    }),
    AuthModule,
    UsersModule,
    LocationsModule,
    AssetTypesModule,
    RoutingModule,
    TicketsModule,
    StorageModule,
    AuditModule,
    NotificationsModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit → signed in → allowed role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
