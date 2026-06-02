import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private readonly bucket = process.env.MINIO_BUCKET!;
  private readonly publicUrl = process.env.MINIO_PUBLIC_URL!;

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
    await this.ensureBucket();
  }

  async upload(key: string, buffer: Buffer, mimetype: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  extractKey(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    const prefix = `${this.publicUrl}/${this.bucket}/`;
    if (!imageUrl.startsWith(prefix)) return null;
    return imageUrl.slice(prefix.length) || null;
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete object "${key}": ${(err as Error).message}`);
    }
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket "${this.bucket}"`);
    }

    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    });

    await this.client.send(new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: policy }));
  }
}
