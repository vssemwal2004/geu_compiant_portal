import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LocationType } from '../common/enums';

/**
 * Campus → building → floor → lab/room tree.
 * `ancestors` holds the parent chain root-first, so "everything under GR Block" and
 * "most specific routing rule" are single indexed queries.
 */
@Schema({ collection: 'locations', timestamps: true })
export class Location {
  @Prop({ type: Types.ObjectId, ref: 'Location', default: null, index: true })
  parentId: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], ref: 'Location', default: [], index: true })
  ancestors: Types.ObjectId[];

  @Prop({ required: true, enum: Object.values(LocationType) })
  type: LocationType;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ trim: true, uppercase: true, maxlength: 20 })
  code?: string;

  @Prop({ default: true, index: true })
  active: boolean;
}

export type LocationDocument = HydratedDocument<Location>;
export const LocationSchema = SchemaFactory.createForClass(Location);
// No duplicate names under the same parent.
LocationSchema.index({ parentId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
