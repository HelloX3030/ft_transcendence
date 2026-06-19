<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { severalMovies } from '@/lib/test';
import VideoPlayer from '@/components/videoplayer/VideoPlayer.vue';
import { Button } from '@/components/ui/button';
import { Heart, X, Bookmark, ArrowLeft } from 'lucide-vue-next';

const isLiked = ref(false);
const isDisliked = ref(false);
const isSaved = ref(false);

const route = useRoute();

const showTrailer = ref(false);

const movie = computed(() => severalMovies.find((m) => m.id === Number(route.params.id)));
const similarMovies = computed(() => severalMovies.filter((m) => m.id !== movie.value?.id));
const director = 'Unbekannt';
const topCast = computed(() => movie.value?.credits.cast.slice(0, 3) ?? []);
const releaseYear = computed(() => movie.value?.release_date.slice(0, 4) ?? '');
const formattedRuntime = computed(() => {
  const mins = movie.value?.runtime;
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
});
const rating = computed(() => movie.value?.vote_average.toFixed(1) ?? '');
const providers = computed(() => movie.value?.watchProviders.results.DE?.flatrate ?? []);
const backdropUrl = computed(() => `https://image.tmdb.org/t/p/w1280${movie.value?.backdrop_path}`);
const posterUrl = computed(() => `https://image.tmdb.org/t/p/w342${movie.value?.poster_path}`);

const showControls = ref(true);
let hideTimer: ReturnType<typeof setTimeout>;

function handleMouseMove() {
  showControls.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    showControls.value = false;
  }, 5000);
}
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Fallback wenn Film nicht gefunden -->
    <div v-if="!movie" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Film not found.</p>
    </div>

    <div v-else>
      <!-- Hero: Backdrop -->
      <div class="relative w-full h-80">
        <img :src="backdropUrl" :alt="movie.title" class="w-full h-full object-cover object-top" />
        <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
      </div>

      <!-- Content wrapper mit max-width -->
      <div class="max-w-2xl mx-auto">
        <!-- Poster + Titel -->
        <div class="flex gap-6 px-4 -mt-24 relative z-10">
          <img
            :src="posterUrl"
            :alt="movie.title"
            class="w-36 rounded-xl shadow-2xl flex-shrink-0"
          />
          <div class="flex flex-col justify-end pb-2">
            <h1 class="text-2xl font-bold leading-tight">{{ movie.title }}</h1>
            <p class="text-sm text-zinc-400 mt-1 italic">{{ movie.tagline }}</p>
            <div class="flex items-center gap-2 text-sm text-zinc-400 mt-2">
              <span>{{ releaseYear }}</span>
              <span>·</span>
              <span>{{ formattedRuntime }}</span>
              <span>·</span>
              <span class="text-yellow-400 font-medium">⭐ {{ rating }}</span>
              <span class="text-zinc-600 text-xs">({{ movie.vote_count.toLocaleString() }})</span>
            </div>
          </div>
        </div>

        <!-- Genres -->
        <div class="flex flex-wrap gap-2 px-6 mt-6">
          <span
            v-for="genre in movie.genres"
            :key="genre.id"
            class="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
          >
            {{ genre.name }}
          </span>
        </div>

        <!-- Description -->
        <div class="px-6 mt-4">
          <p class="text-sm text-zinc-300 leading-relaxed">{{ movie.overview }}</p>
        </div>

        <!-- Director -->
        <div class="px-6 mt-8">
          <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Director</p>
          <p class="text-sm text-zinc-200">{{ director }}</p>
        </div>

        <!-- Cast -->
        <div class="px-6 mt-8">
          <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Cast</p>
          <div class="flex gap-6">
            <div
              v-for="actor in topCast"
              :key="actor.id"
              class="flex flex-col items-center gap-2 w-24"
            >
              <img
                :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`"
                :alt="actor.name"
                class="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-700"
              />
              <p
                class="text-xs text-center text-zinc-300 leading-tight font-medium w-full line-clamp-2"
              >
                {{ actor.name }}
              </p>
              <p class="text-xs text-center text-zinc-500 leading-tight w-full line-clamp-2">
                {{ actor.character }}
              </p>
            </div>
          </div>
        </div>

        <!-- Watch Providers -->
        <div class="px-6 mt-8">
          <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Available on</p>
          <div class="flex gap-4">
            <div
              v-for="provider in providers"
              :key="provider.provider_id"
              class="flex flex-col items-center gap-2"
            >
              <img
                :src="`https://image.tmdb.org/t/p/w92${provider.logo_path}`"
                :alt="provider.provider_name"
                class="w-12 h-12 rounded-xl object-cover"
              />
              <p class="text-xs text-zinc-400">{{ provider.provider_name }}</p>
            </div>
          </div>
        </div>

        <!-- More like this -->
        <div class="mt-8 pb-32">
          <p class="text-xs text-zinc-500 uppercase tracking-wider px-6 mb-3">More like this</p>
          <div class="flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-hide">
            <div
              v-for="film in similarMovies"
              :key="film.id"
              class="flex-shrink-0 w-28 cursor-pointer"
              @click="$router.push(`/moviedetail/${film.id}`)"
            >
              <img
                :src="`https://image.tmdb.org/t/p/w185${film.poster_path}`"
                :alt="film.title"
                class="w-28 h-40 object-cover rounded-xl"
              />
              <p class="text-xs text-zinc-300 mt-2 line-clamp-2 leading-tight">{{ film.title }}</p>
              <p class="text-xs text-zinc-500 mt-1">⭐ {{ film.vote_average.toFixed(1) }}</p>
            </div>
          </div>
        </div>
      </div>
      <!-- end max-w-2xl -->

      <!-- Social Buttons + Trailer Button rechts -->
      <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <!-- Social Icons als Pill wie Trailer Button -->
        <div
          class="flex items-center gap-4 bg-zinc-800 text-zinc-300 font-semibold px-5 py-3 rounded-full shadow-xl"
        >
          <button
            @click="
              isLiked = !isLiked;
              if (isLiked) isDisliked = false;
            "
          >
            <Heart
              :class="isLiked ? 'text-red-500 fill-red-500' : 'text-zinc-300'"
              class="size-5"
            />
          </button>
          <button
            @click="
              isDisliked = !isDisliked;
              if (isDisliked) isLiked = false;
            "
          >
            <X
              :class="isDisliked ? 'text-blue-400 fill-blue-400' : 'text-zinc-300'"
              class="size-5"
            />
          </button>
          <button @click="isSaved = !isSaved">
            <Bookmark
              :class="isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-300'"
              class="size-5"
            />
          </button>
        </div>

        <!-- Trailer Button -->
        <button
          class="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold px-5 py-3 rounded-full shadow-xl transition-all duration-200"
          @click="showTrailer = true"
        >
          ▶ Trailer
        </button>
      </div>

      <!-- Trailer Modal -->
      <div
        v-if="showTrailer && movie"
        class="fixed inset-0 z-50 bg-black"
        @mousemove="handleMouseMove"
      >
        <div v-show="showControls" class="absolute bottom-6 md:bottom-10 left-6 z-50">
          <Button
            variant="outline"
            class="rounded-full size-11 flex items-center justify-center"
            @click="showTrailer = false"
          >
            <ArrowLeft class="size-5" />
          </Button>
        </div>

        <VideoPlayer
          :title="movie.title"
          :video-id="movie.trailerKey"
          :active="showTrailer"
          :genre-ids="movie.genres.map((g) => g.id)"
          :release-date="movie.release_date"
          :providers="[]"
          :show-genres="false"
          class="w-full h-full"
        />
      </div>
    </div>
    <!-- end v-else -->
  </div>
</template>
