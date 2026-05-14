-- CreateEnum
CREATE TYPE "friend_status" AS ENUM ('pending', 'accepted', 'blocked');

-- CreateEnum
CREATE TYPE "language_code" AS ENUM ('de', 'en', 'es');

-- CreateEnum
CREATE TYPE "reaction_type" AS ENUM ('like', 'dislike');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "watchlist_role" AS ENUM ('owner', 'editor', 'viewer');

-- custom:     CONSTRAINT "check_user_order" CHECK ("user_a_id" < "user_b_id"),
-- CreateTable
CREATE TABLE "friends" (
    "user_a_id" INTEGER NOT NULL,
    "user_b_id" INTEGER NOT NULL,
    "status" "friend_status" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "check_user_order" CHECK ("user_a_id" < "user_b_id"),
    CONSTRAINT "friends_pkey" PRIMARY KEY ("user_a_id","user_b_id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" SERIAL NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- custom:     CHECK ("movie_rating" BETWEEN 0 AND 5),
-- CreateTable
CREATE TABLE "ratings" (
    "user_id" INTEGER NOT NULL,
    "movie_id" INTEGER NOT NULL,
    "trailer_rating" "reaction_type" NOT NULL,
    "movie_rating" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT timezone('utc'::text, now()),

    CHECK ("movie_rating" BETWEEN 0 AND 5),
    CONSTRAINT "ratings_pkey" PRIMARY KEY ("user_id","movie_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "password" VARCHAR(512) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "image" VARCHAR(255),
    "language" "language_code" NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_movies" (
    "watchlist_id" INTEGER NOT NULL,
    "movie_id" INTEGER NOT NULL,

    CONSTRAINT "watchlist_movies_pkey" PRIMARY KEY ("watchlist_id","movie_id")
);

-- CreateTable
CREATE TABLE "watchlist_users" (
    "watchlist_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "watchlist_role" NOT NULL,

    CONSTRAINT "watchlist_users_pkey" PRIMARY KEY ("watchlist_id","user_id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "image" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "watchlist_movies" ADD CONSTRAINT "watchlist_movies_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "watchlist_movies" ADD CONSTRAINT "watchlist_movies_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "watchlist_users" ADD CONSTRAINT "watchlist_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "watchlist_users" ADD CONSTRAINT "watchlist_users_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
