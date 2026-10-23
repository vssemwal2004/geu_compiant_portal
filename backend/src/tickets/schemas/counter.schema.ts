import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Atomic sequences, e.g. _id "ticket-2026" → seq 187 gives GEU-2026-000187. */
@Schema({ collection: 'counters', versionKey: false })
export class Counter {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
