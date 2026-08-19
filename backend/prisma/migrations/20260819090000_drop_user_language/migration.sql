/*
  Warnings:

  - You are about to drop the column `language` on the `users` table. All the data in the column will be lost.
  - You are about to drop the enum `language_code`. `users.language` was its only reference.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "language";

-- DropEnum
DROP TYPE "language_code";
