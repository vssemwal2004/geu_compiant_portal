import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetTypesModule } from '../asset-types/asset-types.module';
import { AuditModule } from '../audit/audit.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoutingModule } from '../routing/routing.module';
import { StorageModule } from '../storage/storage.module';
import { User, UserSchema } from '../users/user.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { Escalation, EscalationSchema } from './schemas/escalation.schema';
import { Ticket, TicketSchema } from './schemas/ticket.schema';
import { TicketEvent, TicketEventSchema } from './schemas/ticket-event.schema';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: TicketEvent.name, schema: TicketEventSchema },
      { name: Escalation.name, schema: EscalationSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: User.name, schema: UserSchema },
    ]),
    LocationsModule,
    AssetTypesModule,
    RoutingModule,
    StorageModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
