import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** "Tickets for <asset type> at <location or anything under it> go to <Sub-Admin>." */
@Schema({ collection: 'routing_rules', timestamps: true })
export class RoutingRule {
  @Prop({ type: Types.ObjectId, ref: 'Location', required: true })
  locationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AssetType', required: true })
  assetTypeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  subAdminId: Types.ObjectId;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export type RoutingRuleDocument = HydratedDocument<RoutingRule>;
export const RoutingRuleSchema = SchemaFactory.createForClass(RoutingRule);
// At most one active rule per location + asset type — conflicts are impossible by construction.
RoutingRuleSchema.index(
  { locationId: 1, assetTypeId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: 'one_active_rule_per_location_asset' },
);
RoutingRuleSchema.index({ assetTypeId: 1, active: 1, locationId: 1 });
