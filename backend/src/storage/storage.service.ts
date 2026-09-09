import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import { MetricsService } from 'src/metrics/metrics.service';

export interface StoredObject {
  body: Readable;
  /** Byte count reported by the store, or null if it did not send one. */
  contentLength: number | null;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucketReady = false;
  private readonly bucket = process.env.MINIO_BUCKET!;

  constructor(private readonly metrics: MetricsService) {}

  async onModuleInit() {
    this.client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT!,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
    // Like RedisModule, don't let a missing/unreachable MinIO crash the app at
    // boot, log and retry lazily on the first upload instead.
    try {
      await this.ensureBucket();
    } catch (err) {
      this.logger.warn(
        `MinIO not ready at startup: ${(err as Error).message}. Will retry on first upload.`,
      );
    }
  }

  async upload(key: string, buffer: Buffer, mimetype: string): Promise<void> {
    try {
      await this.ensureBucket();
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
      this.metrics.recordUpload('success', buffer.byteLength);
    } catch (err) {
      this.metrics.recordUpload('failure');
      this.logger.error(`Upload failed for "${key}": ${(err as Error).message}`);
      throw new ServiceUnavailableException('File storage is currently unavailable');
    }
  }

  /**
   * Opens a read stream for an object. The bucket is private and only reachable
   * from inside the network, so this is the single path bytes take to a client,
   * and it runs behind the authorization in FilesService.
   */
  async getObject(key: string): Promise<StoredObject> {
    let response;
    try {
      response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      // A row without its object is a broken reference, not an outage, 404 so a
      // stale id does not read as "storage is down".
      if (this.isNotFound(err)) {
        this.logger.warn(`Object "${key}" is referenced by a row but missing from the bucket`);
        throw new NotFoundException('File not found');
      }
      this.logger.error(`Read failed for "${key}": ${(err as Error).message}`);
      throw new ServiceUnavailableException('File storage is currently unavailable');
    }

    if (response.Body === undefined) {
      throw new ServiceUnavailableException('File storage is currently unavailable');
    }
    return {
      body: response.Body as Readable,
      contentLength: response.ContentLength ?? null,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete object "${key}": ${(err as Error).message}`);
    }
  }

  private async ensureBucket() {
    // Idempotent and cached: once the bucket is confirmed ready we skip the
    // round-trip, so calling this on every upload is effectively free.
    if (this.bucketReady) return;

    if (await this.bucketExists()) {
      this.bucketReady = true;
      return;
    }

    // No bucket policy: the bucket stays private and is never reachable from a
    // browser. Every read goes through GET /files/:id, which authenticates first.
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.logger.log(`Created bucket "${this.bucket}"`);
    this.bucketReady = true;
  }

  private async bucketExists(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch (err) {
      // A 404/NotFound means the bucket is genuinely missing, anything else
      // (network, auth, permissions) is a real error we must not swallow.
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  private isNotFound(err: unknown): boolean {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (err as { name?: string })?.name;
    return status === 404 || name === 'NotFound' || name === 'NoSuchBucket' || name === 'NoSuchKey';
  }
}
