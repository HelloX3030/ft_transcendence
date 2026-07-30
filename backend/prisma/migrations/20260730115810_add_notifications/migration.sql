-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('friend_request_created', 'friend_request_accepted', 'friend_request_declined', 'friend_request_cancelled', 'friend_removed', 'watchlist_user_added', 'watchlist_user_removed', 'watchlist_movie_added', 'watchlist_movie_removed', 'watchlist_deleted');

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "notification_type" NOT NULL,
    "actor_id" INTEGER,
    "entity_id" INTEGER,
    "params" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
