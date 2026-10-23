import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxMessage, OutboxSchema } from './outbox.schema';
import { OutboxService } from './outbox.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: OutboxMessage.name, schema: OutboxSchema }])],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class NotificationsModule {}
