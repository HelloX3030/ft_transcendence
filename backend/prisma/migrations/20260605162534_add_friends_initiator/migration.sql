/*
  Warnings:

  - Added the required column `initiator_id` to the `friends` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "friends" ADD COLUMN     "initiator_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
