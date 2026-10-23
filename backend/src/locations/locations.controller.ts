import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { LocationType, Role } from '../common/enums';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { LocationsService } from './locations.service';

class CreateLocationDto {
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @IsEnum(LocationType)
  type: LocationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}

class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class ListQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

@Controller()
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  /** Full active tree (inactive too for the Main Admin with ?includeInactive=true). */
  @Get('locations')
  list(@CurrentUser() user: AuthUser, @Query() q: ListQuery) {
    return this.locations.list(user.role === Role.MAIN_ADMIN && !!q.includeInactive);
  }

  /** Locations the signed-in user may raise tickets for. */
  @Get('locations/permitted')
  permitted(@CurrentUser() user: AuthUser) {
    return this.locations.permittedFor(user);
  }

  @Post('admin/locations')
  @Roles(Role.MAIN_ADMIN)
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create({ ...dto, parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined });
  }

  @Patch('admin/locations/:id')
  @Roles(Role.MAIN_ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }
}
