import {
  CreateBucketCommand,
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
  private readonly bucket = process.env.MINIO_BUCKET ?? 'avatars';
  private readonly publicUrl = process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000';

  async onModuleInit() {
    this.client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? 'http://minio:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
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
