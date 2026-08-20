import { computed, ref } from 'vue';

const sortOptions = ['popularity', 'revenue', 'vote_average', 'release_date'] as const;

const currentYear = new Date().getFullYear();
const MIN_YEAR = 1900;

// A year field only produces a release-date filter once it holds a complete,
// in-range year. While the user types ("1" -> "19" -> "199" -> "1990") the
// partial values are ignored, so we never emit a malformed date like "1-01-01"
// (which the backend's YYYY-MM-DD validation rejects) or fire a request per
// keystroke.
function isCompleteYear(year: number | undefined): year is number {
  return year != null && Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear;
}

const yearFrom = ref<number | undefined>(undefined);
const yearTo = ref<number | undefined>(currentYear);

// TMDB genre ids (not names), `with_genres` expects ids. Names for display are
// resolved from the genres store at render time.
const selectedGenres = ref<number[]>([]);

const sortDirection = ref<'asc' | 'desc'>('desc');

const sortField = ref<(typeof sortOptions)[number] | 'default'>('default');
// With no explicit field chosen, fall back to `popularity` so the asc/desc
// toggle still reorders the (popularity-sorted) default list instead of being a
// no-op. popularity.desc matches the backend default, so this changes nothing
// until the direction is flipped.
const sortBy = computed(() => {
  const field = sortField.value === 'default' ? 'popularity' : sortField.value;
  return `${field}.${sortDirection.value}`;
});
const withGenres = computed(() =>
  selectedGenres.value.length > 0 ? `${selectedGenres.value.join(',')}` : undefined,
);

const primaryReleaseDateGte = computed(() =>
  isCompleteYear(yearFrom.value) ? `${yearFrom.value}-01-01` : undefined,
);
const primaryReleaseDateLte = computed(() =>
  isCompleteYear(yearTo.value) ? `${yearTo.value}-12-31` : undefined,
);

export function useSearchFilter() {
  function toggleGenre(genreId: number, checked: boolean) {
    if (checked) selectedGenres.value.push(genreId);
    else selectedGenres.value = selectedGenres.value.filter((id) => id !== genreId);
  }

  function removeGenre(genreId: number) {
    selectedGenres.value = selectedGenres.value.filter((id) => id !== genreId);
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
