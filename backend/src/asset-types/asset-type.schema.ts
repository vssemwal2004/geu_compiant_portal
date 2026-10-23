import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TicketPriority } from '../common/enums';

@Schema({ collection: 'asset_types', timestamps: true })
export class AssetType {
  @Prop({ required: true, trim: true, maxlength: 60 })
  name: string;

  @Prop({ required: true, unique: true, trim: true, uppercase: true, maxlength: 12 })
  code: string;

  /** Priority a new ticket gets for this asset type; staff can change it later. */
  @Prop({ enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM })
  defaultPriority: TicketPriority;

  @Prop({ default: true })
  active: boolean;
}

export type AssetTypeDocument = HydratedDocument<AssetType>;
export const AssetTypeSchema = SchemaFactory.createForClass(AssetType);
