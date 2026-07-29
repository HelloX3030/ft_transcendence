-- AlterTable
-- totp_active carries DEFAULT false so this applies to a populated users table.
-- Without it Prisma generates a bare NOT NULL, which aborts on any existing row
-- and leaves the migration in a failed state (P3009).
ALTER TABLE "users" ADD COLUMN     "totp_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" VARCHAR(512);
