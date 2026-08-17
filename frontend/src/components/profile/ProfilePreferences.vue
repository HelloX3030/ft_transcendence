<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGenresStore } from '@/stores/genres';
import { usePeopleStore } from '@/stores/people';

// Both profile views render the same three cards from the same two stores, so
// the resolving lives here rather than twice.
const props = defineProps<{
  genreIds?: number[];
  actorIds?: number[];
  directorIds?: number[];
}>();

const genres = useGenresStore();
const people = usePeopleStore();

// Map preference id lists to display names, dropping any not yet resolved (the
// catalogue/people cache may still be loading, or an id may be stale).
function resolveNames(ids: number[] | undefined, lookup: (id: number) => string | undefined) {
  return (ids ?? []).map(lookup).filter((name): name is string => name !== undefined);
}

const preferenceSections = computed(() => [
  {
    label: 'Favorite Genres',
    items: resolveNames(props.genreIds, genres.genreName),
    empty: 'No favorite genres yet',
  },
  {
    label: 'Favorite Directors',
    items: resolveNames(props.directorIds, people.personName),
    empty: 'No favorite directors yet',
  },
  {
    label: 'Favorite Actors',
    items: resolveNames(props.actorIds, people.personName),
    empty: 'No favorite actors yet',
  },
]);

// The person ids to resolve, recomputed when the profile loads (it may arrive
// after this component mounts, and the route may swap it for another user's).
const personIds = computed(() => [...(props.directorIds ?? []), ...(props.actorIds ?? [])]);

onMounted(() => {
  void genres.ensureLoaded();
});

watch(
  personIds,
  (ids) => {
    if (ids.length) void people.ensureLoaded(ids);
  },
  { immediate: true },
);
</script>

<template>
  <!-- Empty sections still render their card: hiding them would make a sparse
       profile look broken and jump the page height between users. -->
  <Card v-for="section in preferenceSections" :key="section.label">
    <CardHeader>
      <CardTitle class="text-muted-foreground text-sm font-medium">{{ section.label }}</CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="section.items.length" class="flex flex-wrap gap-2">
        <span
          v-for="item in section.items"
          :key="item"
          class="text-primary rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium"
        >
          {{ item }}
        </span>
      </div>
      <p v-else class="text-muted-foreground text-sm">{{ section.empty }}</p>
    </CardContent>
  </Card>
</template>
