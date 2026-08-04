-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "previous_hash" VARCHAR(512),
ADD COLUMN     "rotated_at" TIMESTAMP(3);
