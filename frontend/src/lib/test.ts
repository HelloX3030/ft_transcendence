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

export const severalMovies = [
  {
    adult: false,
    backdrop_path: '/9n2tJBplPbgR2ca05hS5CKXwP2c.jpg',
    id: 502356,
    imdb_id: 'tt6718170',
    origin_country: ['US'],
    original_language: 'en',
    original_title: 'The Super Mario Bros. Movie',
    overview:
      'While working underground to fix a water main, Brooklyn plumbers—and brothers—Mario and Luigi are transported down a mysterious pipe and wander into a magical new world. But when the brothers are separated, Mario embarks on an epic quest to find Luigi.',
    popularity: 31.8114,
    poster_path: '/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
    release_date: '2023-04-05',
    revenue: 1360879735,
    runtime: 93,
    status: 'Released',
    tagline: 'Not all heroes wear capes. Some wear overalls.',
    title: 'The Super Mario Bros. Movie',
    vote_average: 7.604,
    vote_count: 10790,
    trailerKey: 'f4LdtAazviE',
    genres: [
      { id: 10751, name: 'Family' },
      { id: 35, name: 'Comedy' },
      { id: 12, name: 'Adventure' },
      { id: 14, name: 'Fantasy' },
      { id: 16, name: 'Animation' },
    ],
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
  },
  {
    adult: false,
    backdrop_path: '/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg',
    id: 76600,
    imdb_id: 'tt1630029',
    origin_country: ['US'],
    original_language: 'en',
    original_title: 'Avatar: The Way of Water',
    overview:
      'Set more than a decade after the events of the first film, learn the story of the Sully family (Jake, Neytiri, and their kids), the trouble that follows them, the lengths they go to keep each other safe, the battles they fight to stay alive, and the tragedies they endure.',
    popularity: 24.9235,
    poster_path: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    release_date: '2022-12-14',
    revenue: 2353096253,
    runtime: 192,
    status: 'Released',
    tagline: 'Return to Pandora.',
    title: 'Avatar: The Way of Water',
    vote_average: 7.594,
    vote_count: 14176,
    trailerKey: '8gSJ3td9OhM',
    genres: [
      { id: 28, name: 'Action' },
      { id: 12, name: 'Adventure' },
      { id: 878, name: 'Science Fiction' },
    ],
    credits: {
      cast: [
        {
          id: 65731,
          name: 'Sam Worthington',
          character: 'Jake Sully',
          profile_path: '/vM1WIfYQ1HUBtlVPwB9Hp9fLcn8.jpg',
        },
        {
          id: 8691,
          name: 'Zoe Saldaña',
          character: 'Neytiri',
          profile_path: '/fCJuIn1PMUQtYdRRSnnoZeMJVWs.jpg',
        },
        {
          id: 10205,
          name: 'Sigourney Weaver',
          character: 'Kiri',
          profile_path: '/wTSnfktNBLd6kwQxgvkqYw6vEon.jpg',
        },
      ],
    },
    watchProviders: {
      results: {
        DE: {
          link: 'https://www.themoviedb.org/movie/76600/watch?locale=DE',
          flatrate: [
            {
              logo_path: '/97yvRBw1GzX7fXprcF80er19ot.jpg',
              provider_id: 337,
              provider_name: 'Disney Plus',
              display_priority: 0,
            },
          ],
        },
      },
    },
  },
  {
    adult: false,
    backdrop_path: '/kQV9sV0IbastbU5FYxuYwxfMawz.jpg',
    id: 594767,
    imdb_id: 'tt10151854',
    origin_country: ['US'],
    original_language: 'en',
    original_title: 'Shazam! Fury of the Gods',
    overview:
      'Billy Batson and his foster siblings, who transform into superheroes by saying "Shazam!", are forced to get back into action and fight the Daughters of Atlas, who they must stop from using a weapon that could destroy the world.',
    popularity: 5.6409,
    poster_path: '/3GrRgt6CiLIUXUtoktcv1g2iwT5.jpg',
    release_date: '2023-03-15',
    revenue: 134221819,
    runtime: 130,
    status: 'Released',
    tagline: 'Oh. My. Gods.',
    title: 'Shazam! Fury of the Gods',
    vote_average: 6.4,
    vote_count: 3643,
    trailerKey: 'AIc671o9yCI',
    genres: [
      { id: 35, name: 'Comedy' },
      { id: 28, name: 'Action' },
      { id: 14, name: 'Fantasy' },
    ],
    credits: {
      cast: [
        {
          id: 69899,
          name: 'Zachary Levi',
          character: 'Shazam',
          profile_path: '/1W8L3kEMMPF9umT3ZGaNIiCYKfZ.jpg',
        },
        {
          id: 1768966,
          name: 'Asher Angel',
          character: 'Billy Batson',
          profile_path: '/lgBt67iggDs0d8QBSyjdk2ytHtK.jpg',
        },
        {
          id: 1774679,
          name: 'Jack Dylan Grazer',
          character: 'Freddy Freeman',
          profile_path: '/wkLAOleFx9Pis97g6t3noJRhAwg.jpg',
        },
      ],
    },
    watchProviders: {
      results: {
        DE: {
          link: 'https://www.themoviedb.org/movie/594767/watch?locale=DE',
          flatrate: [
            {
              logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
              provider_id: 8,
              provider_name: 'Netflix',
              display_priority: 0,
            },
            {
              logo_path: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg',
              provider_id: 1899,
              provider_name: 'HBO Max',
              display_priority: 1,
            },
          ],
        },
      },
    },
  },
];
