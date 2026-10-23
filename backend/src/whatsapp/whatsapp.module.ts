import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/user.schema';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappEvent, WhatsappEventSchema, WhatsappSession, WhatsappSessionSchema } from './whatsapp.schemas';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsappEvent.name, schema: WhatsappEventSchema },
      { name: WhatsappSession.name, schema: WhatsappSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
