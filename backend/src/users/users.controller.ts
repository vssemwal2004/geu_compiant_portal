import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { Role, UserStatus } from '../common/enums';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { UsersService } from './users.service';

const toIds = (ids?: string[]) => ids?.map((id) => new Types.ObjectId(id));

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @Matches(/^[A-Za-z0-9/_-]{2,30}$/, { message: 'employeeId must be 2–30 letters, digits, /, - or _' })
  employeeId: string;

  @IsIn([Role.SUB_ADMIN, Role.LAB_ASSISTANT])
  role: Role.SUB_ADMIN | Role.LAB_ASSISTANT;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  /** WhatsApp number; Indian 10-digit numbers get +91 automatically. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  allowedLocationIds?: string[];
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  /** Send null or "" to remove the number. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  allowedLocationIds?: string[];

  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.DISABLED])
  status?: UserStatus.ACTIVE | UserStatus.DISABLED;
}

class ListUsersQuery {
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

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
  limit = 25;
}

@Controller('admin/users')
@Roles(Role.MAIN_ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Create a Sub-Admin or Lab Assistant; the response contains a one-time invite link to share. */
  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(admin, { ...dto, allowedLocationIds: toIds(dto.allowedLocationIds) });
  }

  @Get()
  list(@Query() q: ListUsersQuery) {
    return this.users.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.users.get(id);
  }

  /** Edit details, change location access, or deactivate (status: DISABLED). */
  @Patch(':id')
  update(@CurrentUser() admin: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: UpdateUserDto) {
    return this.users.update(admin, id, { ...dto, allowedLocationIds: toIds(dto.allowedLocationIds) });
  }

  /** Fresh invite link (not yet activated) or password-reset link (active account). */
  @Post(':id/account-link')
  accountLink(@CurrentUser() admin: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.users.accountLink(admin, id);
  }

  @Post(':id/verify-phone')
  verifyPhone(@CurrentUser() admin: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.users.markPhoneVerified(admin, id);
  }
}
