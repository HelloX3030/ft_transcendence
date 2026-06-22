/*
  Warnings:

  - Added the required column `totpActive` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totpActive" BOOLEAN NOT NULL,
ADD COLUMN     "totpSecret" VARCHAR(512);
