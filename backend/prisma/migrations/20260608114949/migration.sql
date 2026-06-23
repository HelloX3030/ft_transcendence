/*
  Warnings:

  - The values [blocked] on the enum `friend_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "friend_status_new" AS ENUM ('pending', 'accepted');
ALTER TABLE "friends" ALTER COLUMN "status" TYPE "friend_status_new" USING ("status"::text::"friend_status_new");
ALTER TYPE "friend_status" RENAME TO "friend_status_old";
ALTER TYPE "friend_status_new" RENAME TO "friend_status";
DROP TYPE "public"."friend_status_old";
COMMIT;
