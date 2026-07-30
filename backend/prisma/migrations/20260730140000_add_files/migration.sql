-- CreateEnum
CREATE TYPE "file_kind" AS ENUM ('avatar');

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "mimetype" VARCHAR(64) NOT NULL,
    "size" INTEGER NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "kind" "file_kind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"("key");

-- CreateIndex
CREATE INDEX "files_owner_id_kind_idx" ON "files"("owner_id", "kind");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_file_id" INTEGER;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing avatars. users.image holds a fully-qualified MinIO URL whose
-- last path segment is the object key, so a row per non-null image reproduces the
-- upload as if it had gone through the new path. Nobody's avatar disappears.
-- `size` is 0 because the byte count was never stored; it is informational only,
-- serving reads Content-Length back from the object itself.
INSERT INTO "files" ("owner_id", "key", "mimetype", "size", "original_name", "kind")
SELECT
    u."id",
    substring(u."image" from '[^/]+$'),
    CASE
        WHEN u."image" LIKE '%.png'  THEN 'image/png'
        WHEN u."image" LIKE '%.jpg'  THEN 'image/jpeg'
        WHEN u."image" LIKE '%.jpeg' THEN 'image/jpeg'
        WHEN u."image" LIKE '%.webp' THEN 'image/webp'
        ELSE 'application/octet-stream'
    END,
    0,
    substring(u."image" from '[^/]+$'),
    'avatar'::"file_kind"
FROM "users" u
WHERE u."image" IS NOT NULL
  AND substring(u."image" from '[^/]+$') IS NOT NULL;

UPDATE "users" u
SET "avatar_file_id" = f."id"
FROM "files" f
WHERE f."owner_id" = u."id"
  AND f."key" = substring(u."image" from '[^/]+$');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "image";

-- AlterTable: dead write-only column, nothing ever rendered it (spec 03 §1.3).
ALTER TABLE "watchlists" DROP COLUMN "image";
