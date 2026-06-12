export const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'Bearer ' + import.meta.env.VITE_TMDB_API_KEY,
  },
};

export interface Provider {
  name: string;
  logoPath: string;
}

export const PROVIDERS = {
  NETFLIX: { name: 'Netflix', logoPath: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  AMAZON: { name: 'Amazon Prime Video', logoPath: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  HBO: { name: 'HBO Max', logoPath: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
  DISNEY: { name: 'Disney Plus', logoPath: '/97yvRBw1GzX7fXprcF80er19ot.jpg' },
  WOW: { name: 'WOW', logoPath: '/9r5zFWuYnwjzO1JrNjSbLQwUc3P.jpg' },
};

export const popular = [
  {
    adult: false,
    backdrop_path: '/gMJngTNfaqCSCqGD4y8lVMZXKDn.jpg',
    genre_ids: [28, 12, 878],
    id: 640146,
    original_language: 'en',
    original_title: 'Ant-Man and the Wasp: Quantumania',
    overview:
      "Super-Hero partners Scott Lang and Hope van Dyne, along with with Hope's parents Janet van Dyne and Hank Pym, and Scott's daughter Cassie Lang, find themselves exploring the Quantum Realm, interacting with strange new creatures and embarking on an adventure that will push them beyond the limits of what they thought possible.",
    popularity: 8567.865,
    poster_path: '/ngl2FKBlU4fhbdsrtdom9LVLBXw.jpg',
    release_date: '2023-02-15',
    title: 'Ant-Man and the Wasp: Quantumania',
    video: false,
    vote_average: 6.5,
    vote_count: 1886,
    key: '3SgL3ygGm1s',
    providers: [PROVIDERS.NETFLIX, PROVIDERS.DISNEY],
  },
  {
    adult: false,
    backdrop_path: '/iJQIbOPm81fPEGKt5BPuZmfnA54.jpg',
    genre_ids: [16, 12, 10751, 14, 35],
    id: 502356,
    original_language: 'en',
    original_title: 'The Super Mario Bros. Movie',
    overview:
      'While working underground to fix a water main, Brooklyn plumbers—and brothers—Mario and Luigi are transported down a mysterious pipe and wander into a magical new world. But when the brothers are separated, Mario embarks on an epic quest to find Luigi.',
    popularity: 6572.614,
    poster_path: '/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
    release_date: '2023-04-05',
    title: 'The Super Mario Bros. Movie',
    video: false,
    vote_average: 7.5,
    vote_count: 1456,
    key: 'f4LdtAazviE',
    providers: [],
  },
  {
    adult: false,
    backdrop_path: '/nDxJJyA5giRhXx96q1sWbOUjMBI.jpg',
    genre_ids: [28, 35, 14],
    id: 594767,
    original_language: 'en',
    original_title: 'Shazam! Fury of the Gods',
    overview:
      'Billy Batson and his foster siblings, who transform into superheroes by saying "Shazam!", are forced to get back into action and fight the Daughters of Atlas, who they must stop from using a weapon that could destroy the world.',
    popularity: 4274.232,
    poster_path: '/2VK4d3mqqTc7LVZLnLPeRiPaJ71.jpg',
    release_date: '2023-03-15',
    title: 'Shazam! Fury of the Gods',
    video: false,
    vote_average: 6.9,
    vote_count: 1231,
    key: 'BZuJorglKko',
    providers: [PROVIDERS.AMAZON, PROVIDERS.HBO],
  },
  {
    adult: false,
    backdrop_path: '/ovM06PdF3M8wvKb06i4sjW3xoww.jpg',
    genre_ids: [878, 12, 28],
    id: 76600,
    original_language: 'en',
    original_title: 'Avatar: The Way of Water',
    overview:
      'Set more than a decade after the events of the first film, learn the story of the Sully family (Jake, Neytiri, and their kids), the trouble that follows them, the lengths they go to keep each other safe, the battles they fight to stay alive, and the tragedies they endure.',
    popularity: 3365.913,
    poster_path: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    release_date: '2022-12-14',
    title: 'Avatar: The Way of Water',
    video: false,
    vote_average: 7.7,
    vote_count: 7535,
    key: '8gSJ3td9OhM',
    providers: [PROVIDERS.WOW, PROVIDERS.HBO],
  },
];

export const oneMovie = {
  adult: false,
  backdrop_path: '/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg',
  belongs_to_collection: {
    id: 1434561,
    name: 'The Super Mario Collection',
    poster_path: '/jvntZuQBsvODH1YcEiIzOz4ZKFy.jpg',
    backdrop_path: '/a3BEU6vPZZ7MGI7cIWY8thW4w9M.jpg',
  },
  budget: 100000000,
  genres: [
    { id: 10751, name: 'Family' },
    { id: 35, name: 'Comedy' },
    { id: 12, name: 'Adventure' },
    { id: 14, name: 'Fantasy' },
    { id: 16, name: 'Animation' },
  ],
  homepage: 'https://www.uphe.com/movies/the-super-mario-bros-movie',
  id: 502356,
  imdb_id: 'tt6718170',
  origin_country: ['US'],
  original_language: 'en',
  original_title: 'The Super Mario Bros. Movie',
  overview:
    'While working underground to fix a water main, Brooklyn plumbers—and brothers—Mario and Luigi are transported down a mysterious pipe and wander into a magical new world. But when the brothers are separated, Mario embarks on an epic quest to find Luigi.',
  popularity: 31.8114,
  poster_path: '/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
  production_companies: [
    {
      id: 33,
      logo_path: '/8lvHyhjr8oUKOOy2dKXoALWKdp0.png',
      name: 'Universal Pictures',
      origin_country: 'US',
    },
    {
      id: 6704,
      logo_path: '/fOG2oY4m1YuYTQh4bMqqZkmgOAI.png',
      name: 'Illumination',
      origin_country: 'US',
    },
    {
      id: 12288,
      logo_path: '/e4dQAqZD374H5EuM0W1ljEBWTKy.png',
      name: 'Nintendo',
      origin_country: 'JP',
    },
  ],
  production_countries: [
    { iso_3166_1: 'JP', name: 'Japan' },
    { iso_3166_1: 'US', name: 'United States of America' },
  ],
  release_date: '2023-04-05',
  revenue: 1360879735,
  runtime: 93,
  spoken_languages: [{ english_name: 'English', iso_639_1: 'en', name: 'English' }],
  status: 'Released',
  tagline: 'Not all heroes wear capes. Some wear overalls.',
  title: 'The Super Mario Bros. Movie',
  video: false,
  vote_average: 7.604,
  vote_count: 10790,
  trailerKey: 'f4LdtAazviE',
  credits: {
    cast: [
      {
        id: 73457,
        name: 'Chris Pratt',
        character: 'Mario (voice)',
        profile_path: '/cRH6HPAQ98PlOwwEvhYO4CM9lwu.jpg',
      },
      {
        id: 1397778,
        name: 'Anya Taylor-Joy',
        character: 'Princess Peach (voice)',
        profile_path: '/jxAbDJWvz4p1hoFpJYG5vY2dQmq.jpg',
      },
      {
        id: 95101,
        name: 'Charlie Day',
        character: 'Luigi (voice)',
        profile_path: '/c0HNhjChGybnHa4eoLyqO4dDu1j.jpg',
      },
    ],
  },
  watchProviders: {
    results: {
      DE: {
        link: 'https://www.themoviedb.org/movie/502356/watch?locale=DE',
        flatrate: [
          {
            logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
            provider_id: 8,
            provider_name: 'Netflix',
            display_priority: 0,
          },
          {
            logo_path: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg',
            provider_id: 119,
            provider_name: 'Amazon Prime Video',
            display_priority: 1,
          },
        ],
      },
    },
  },
};
