import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { LocationsService } from '../locations/locations.service';
import { RoutingService } from './routing.service';

class CreateRuleDto {
  @IsMongoId()
  locationId: string;

  @IsMongoId()
  assetTypeId: string;

  @IsMongoId()
  subAdminId: string;
}

class UpdateRuleDto {
  @IsOptional()
  @IsMongoId()
  subAdminId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class ListRulesQuery {
  @IsOptional()
  @IsMongoId()
  subAdminId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

class PreviewQuery {
  @IsMongoId()
  locationId: string;

  @IsMongoId()
  assetTypeId: string;
}

@Controller()
export class RoutingController {
  constructor(
    private readonly routing: RoutingService,
    private readonly locations: LocationsService,
  ) {}

  @Get('admin/routing-rules')
  @Roles(Role.MAIN_ADMIN)
  list(@Query() q: ListRulesQuery) {
    return this.routing.list({
      subAdminId: q.subAdminId ? new Types.ObjectId(q.subAdminId) : undefined,
      includeInactive: q.includeInactive,
    });
  }

  @Post('admin/routing-rules')
  @Roles(Role.MAIN_ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRuleDto) {
    return this.routing.create(
      {
        locationId: new Types.ObjectId(dto.locationId),
        assetTypeId: new Types.ObjectId(dto.assetTypeId),
        subAdminId: new Types.ObjectId(dto.subAdminId),
      },
      user.id,
    );
  }

  @Patch('admin/routing-rules/:id')
  @Roles(Role.MAIN_ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateRuleDto) {
    return this.routing.update(id, {
      subAdminId: dto.subAdminId ? new Types.ObjectId(dto.subAdminId) : undefined,
      active: dto.active,
    });
  }

  /** "Who would this ticket go to?" — shown on the review step before submitting. */
  @Get('routing/preview')
  async preview(@Query() q: PreviewQuery) {
    const loc = await this.locations.get(new Types.ObjectId(q.locationId));
    const rule = await this.routing.resolve(this.locations.pathIds(loc), new Types.ObjectId(q.assetTypeId));
    return rule ? { assigneeId: rule.subAdminId, ruleId: rule._id, ruleLocationId: rule.locationId } : { assigneeId: null };
  }
}
