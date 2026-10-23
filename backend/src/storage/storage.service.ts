import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppConfig } from '../config/app-config.service';

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Private bucket + short-lived signed URLs (PDF §14). The browser uploads straight to storage;
 * the API only hands out a signed PUT for a key under the uploader's own prefix, then verifies
 * the object exists (type and size) before attaching it to a ticket.
 */
@Injectable()
export class StorageService {
  private client?: S3Client;

  constructor(private readonly config: AppConfig) {}

  get configured() {
    return this.config.storage.configured;
  }

  private s3() {
    const s = this.config.storage;
    if (!s.configured) throw new ServiceUnavailableException('Image storage is not configured yet (S3_* in .env).');
    this.client ??= new S3Client({
      region: s.region,
      endpoint: s.endpoint,
      forcePathStyle: s.forcePathStyle,
      credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
    });
    return this.client;
  }

  async createUploadUrl(uploaderId: Types.ObjectId, mimeType: string, sizeBytes: number) {
    const ext = ALLOWED_IMAGE_TYPES[mimeType];
    if (!ext) throw new BadRequestException('Use a JPG, PNG or WebP image.');
    if (sizeBytes > this.config.storage.maxBytes)
      throw new BadRequestException(`Image must be ${this.config.storage.maxBytes / 1024 / 1024} MB or smaller.`);

    const storageKey = `uploads/${uploaderId}/${randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: this.config.storage.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const expiresIn = this.config.storage.signedUrlTtl;
    const uploadUrl = await getSignedUrl(this.s3(), command, { expiresIn });
    return { uploadUrl, storageKey, expiresIn, method: 'PUT', headers: { 'Content-Type': mimeType } };
  }

  /** The key must be the uploader's own and the object must really exist with an allowed type/size. */
  async verifyUpload(storageKey: string, uploaderId: Types.ObjectId) {
    if (!storageKey.startsWith(`uploads/${uploaderId}/`)) throw new BadRequestException('Attachment does not belong to you.');
    try {
      const head = await this.s3().send(new HeadObjectCommand({ Bucket: this.config.storage.bucket, Key: storageKey }));
      const type = head.ContentType ?? '';
      if (!ALLOWED_IMAGE_TYPES[type]) throw new BadRequestException('Attachment is not an allowed image type.');
      if ((head.ContentLength ?? 0) > this.config.storage.maxBytes) throw new BadRequestException('Attachment is too large.');
      return { mimeType: type, sizeBytes: head.ContentLength ?? undefined };
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof ServiceUnavailableException) throw e;
      throw new BadRequestException('Attachment upload was not found. Please upload the photo again.');
    }
  }

  async downloadUrl(storageKey: string) {
    if (!this.configured) return null;
    return getSignedUrl(this.s3(), new GetObjectCommand({ Bucket: this.config.storage.bucket, Key: storageKey }), {
      expiresIn: this.config.storage.signedUrlTtl,
    });
  }
}
