import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetTypesModule } from '../asset-types/asset-types.module';
import { LocationsModule } from '../locations/locations.module';
import { User, UserSchema } from '../users/user.schema';
import { RoutingController } from './routing.controller';
import { RoutingRule, RoutingRuleSchema } from './routing-rule.schema';
import { RoutingService } from './routing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoutingRule.name, schema: RoutingRuleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    LocationsModule,
    AssetTypesModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
