import { computed, ref } from 'vue';

const sortOptions = ['popularity', 'revenue', 'vote_average', 'release_date'] as const;

const currentYear = new Date().getFullYear();

const yearFrom = ref<number | undefined>(undefined);
const yearTo = ref<number | undefined>(currentYear);

const selectedGenres = ref<string[]>([]);

const sortDirection = ref<'asc' | 'desc'>('desc');

const sortField = ref<(typeof sortOptions)[number] | 'default'>('default');
const sortBy = computed(() =>
  sortField.value === 'default' ? undefined : `${sortField.value}.${sortDirection.value}`,
);
const withGenres = computed(() =>
  selectedGenres.value.length > 0 ? `${selectedGenres.value.join(',')}` : undefined,
);

const primaryReleaseDateGte = computed(() => {
  return yearFrom.value ? `${yearFrom.value}-01-01` : undefined;
});
const primaryReleaseDateLte = computed(() => (yearTo.value ? `${yearTo.value}-12-31` : undefined));

export function useSearchFilter() {
  function toggleGenre(genre: string, checked: boolean) {
    if (checked) selectedGenres.value.push(genre);
    else selectedGenres.value = selectedGenres.value.filter((g) => g !== genre);
  }

  function removeGenre(genre: string) {
    selectedGenres.value = selectedGenres.value.filter((g) => g !== genre);
  }

  function clearFilters() {
    sortField.value = 'default';
    sortDirection.value = 'desc';
    selectedGenres.value = [];
    yearFrom.value = undefined;
    yearTo.value = currentYear;
  }

  return {
    sortOptions,
    sortField,
    sortDirection,
    sortBy,
    withGenres,
    selectedGenres,
    toggleGenre,
    removeGenre,
    clearFilters,
    yearFrom,
    yearTo,
    primaryReleaseDateGte,
    primaryReleaseDateLte,
  };
}
