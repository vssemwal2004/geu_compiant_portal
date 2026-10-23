import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsInt, Min } from 'class-validator';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { ALLOWED_IMAGE_TYPES, StorageService } from './storage.service';

class UploadRequestDto {
  @IsIn(Object.keys(ALLOWED_IMAGE_TYPES))
  mimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;
}

@Controller('uploads')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Step 1 of attaching a photo: get a signed URL, PUT the file to it from the browser,
   * then send the returned storageKey with POST /tickets (or /tickets/:code/attachments).
   */
  @Post('ticket-image')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: UploadRequestDto) {
    return this.storage.createUploadUrl(user.id, dto.mimeType, dto.sizeBytes);
  }
}
