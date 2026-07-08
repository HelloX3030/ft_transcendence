-- AlterTable
ALTER TABLE "ratings" ADD COLUMN     "watch_time" SMALLINT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "actor_ids" INTEGER[],
ADD COLUMN     "director_ids" INTEGER[],
ADD COLUMN     "feat_vec_updated_at" TIMESTAMP(3),
ADD COLUMN     "feature_vector" DOUBLE PRECISION[],
ADD COLUMN     "genre_ids" INTEGER[],
ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;
