import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TicketPriority, TicketStatus, Visibility } from '../common/enums';
import { TICKET_CODE_PATTERN } from './lifecycle';

@Injectable()
export class ParseTicketCodePipe implements PipeTransform<string, string> {
  transform(value: string) {
    const code = value.trim().toUpperCase();
    if (!TICKET_CODE_PATTERN.test(code)) throw new BadRequestException('Invalid ticket code');
    return code;
  }
}

export class AttachmentInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  storageKey: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class CreateTicketDto {
  @IsMongoId()
  locationId: string;

  @IsMongoId()
  assetTypeId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => AttachmentInput)
  attachments?: AttachmentInput[];
}

export class ListTicketsQuery {
  /** One status or a comma-separated list, e.g. OPEN,REOPENED */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsMongoId()
  assetTypeId?: string;

  /** Matches the location or anything beneath it (e.g. a building). */
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  overdue?: boolean;

  /** Free text: ticket code or description */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ChangeStatusDto {
  @IsEnum(TicketStatus)
  to: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class FeedbackDto {
  @IsIn(['CONFIRM', 'DISPUTE'])
  decision: 'CONFIRM' | 'DISPUTE';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

export class AssignDto {
  @IsMongoId()
  assigneeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PriorityDto {
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class EscalateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class EscalationsQuery {
  @IsOptional()
  @IsIn(['OPEN', 'RESOLVED'])
  status?: 'OPEN' | 'RESOLVED';
}
