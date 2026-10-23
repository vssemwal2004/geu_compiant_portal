import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { Types } from 'mongoose';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { AuditService } from './audit.service';

class AuditQuery {
  @IsOptional()
  @IsIn(['ticket', 'user', 'location', 'assetType', 'routingRule'])
  entityType?: string;

  @IsOptional()
  @IsMongoId()
  entityId?: string;

  @IsOptional()
  @IsMongoId()
  actorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

@Controller('admin/audit-logs')
@Roles(Role.MAIN_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: AuditQuery) {
    return this.audit.list(
      {
        entityType: q.entityType,
        entityId: q.entityId ? new Types.ObjectId(q.entityId) : undefined,
        actorId: q.actorId ? new Types.ObjectId(q.actorId) : undefined,
      },
      q.page,
      q.limit,
    );
  }
}
