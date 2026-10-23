import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Invalid id');
    return new Types.ObjectId(value);
  }
}

export const toObjectId = (value: string | Types.ObjectId) =>
  value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
