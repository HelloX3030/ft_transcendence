/*
  Warnings:

  - The values [owner] on the enum `watchlist_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "watchlist_role_new" AS ENUM ('editor', 'viewer');
ALTER TABLE "watchlist_users" ALTER COLUMN "role" TYPE "watchlist_role_new" USING ("role"::text::"watchlist_role_new");
ALTER TYPE "watchlist_role" RENAME TO "watchlist_role_old";
ALTER TYPE "watchlist_role_new" RENAME TO "watchlist_role";
DROP TYPE "public"."watchlist_role_old";
COMMIT;
