import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Types } from 'mongoose';
import { Roles } from '../common/decorators';
import { Role, TicketPriority } from '../common/enums';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { AssetTypesService } from './asset-types.service';

class CreateAssetTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,12}$/, { message: 'code must be 2–12 letters, digits, - or _' })
  code: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;
}

class UpdateAssetTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller()
export class AssetTypesController {
  constructor(private readonly assetTypes: AssetTypesService) {}

  /** Active asset types, for the ticket form. */
  @Get('asset-types')
  list() {
    return this.assetTypes.list();
  }

  @Get('admin/asset-types')
  @Roles(Role.MAIN_ADMIN)
  listAll() {
    return this.assetTypes.list(true);
  }

  @Post('admin/asset-types')
  @Roles(Role.MAIN_ADMIN)
  create(@Body() dto: CreateAssetTypeDto) {
    return this.assetTypes.create(dto);
  }

  @Patch('admin/asset-types/:id')
  @Roles(Role.MAIN_ADMIN)
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateAssetTypeDto) {
    return this.assetTypes.update(id, dto);
  }
}
