import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { AccountLink, AccountLinkSchema } from './account-link.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard, SessionAuthGuard } from './guards';
import { Session, SessionSchema } from './session.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: AccountLink.name, schema: AccountLinkSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, RolesGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
