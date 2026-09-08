/**
 * Populates a running stack with demo data: users, a friend graph, and the
 * trailer reactions the recommender needs before it will train anything.
 *
 * Everything goes through Caddy on :8443. The backend's own 3000 is exposed to
 * the Docker network but never published to the host, so there is nothing to
 * talk to directly.
 *
 * Usage:
 *   docker compose up -d
 *   npm run seed
 *   npm run retrain     # now has enough data to actually fit a model
 *
 * Re-running is safe: an account that already exists is logged into instead of
 * recreated, and a reaction that was already recorded is left alone.
 *
 * Env overrides: SEED_URL, SEED_USERS, SEED_PREFIX.
 */

// The stack serves a self-signed certificate. console-check.mjs does the same
// thing with playwright's ignoreHTTPSErrors; fetch needs it set before the
// first request goes out.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE_URL = process.env.SEED_URL ?? 'https://localhost:8443/api/v1';
const PREFIX = process.env.SEED_PREFIX ?? 'seed';
const PASSWORD = 'B8skxi!dk&';

/**
 * Five users, six movies, a full friend mesh: 30 reactions, which clears
 * retrain.py's floor of 20 interactions / 3 users / 3 movies with room to
 * spare. Going wider costs real time rather than nothing — see PACE_MS.
 */
const USERS = Number(process.env.SEED_USERS ?? 5);

/**
 * Onboarding takes exactly 10 distinct TMDB ids (OnboardingDto). Without it
 * onboarding_completed stays false and the router bounces every logged-in seed
 * account straight back to /onboarding, so the accounts would be unusable in
 * the UI. Each camp gets its own three films plus this shared filler, which
 * gives the two camps genuinely different taste profiles.
 */
const ONBOARDING_FILLER = [550, 680, 120, 122, 597, 424, 389];

/** Real TMDB ids: POST /movies/:tmdbId/rating calls ensureMovie(), which fetches them. */
const MOVIES = [
  { id: 27205, title: 'Inception', group: 0 },
  { id: 157336, title: 'Interstellar', group: 0 },
  { id: 155, title: 'The Dark Knight', group: 0 },
  { id: 278, title: 'The Shawshank Redemption', group: 1 },
  { id: 238, title: 'The Godfather', group: 1 },
  { id: 13, title: 'Forrest Gump', group: 1 },
];

/**
 * Register and both friend routes sit behind the auth throttler: 20 requests
 * per minute per IP (throttle.config.ts). Nothing here can outrun that, so the
 * script paces itself and backs off on a 429 rather than failing halfway. This
 * is why the run takes a couple of minutes.
 */
const PACE_MS = 300;
const MAX_RETRIES = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (name) => console.log(`\n── ${name}`);

let lastRequest = 0;

/**
 * Is this failure one the caller expects? An entry is either a bare status code
 * or a { status, message } pair, for the endpoints that answer 400 to both a
 * genuine bad request and an "already done" rerun — there the code alone is not
 * specific enough to swallow safely.
 */
const tolerated = (tolerate, status, text) =>
  tolerate.some((t) =>
    typeof t === 'number' ? t === status : t.status === status && t.message.test(text),
  );

/**
 * One paced request. `tolerate` lists the outcomes that are normal for the
 * caller (already registered, already friends, already reacted), so a rerun
 * converges instead of failing.
 */
async function call(path, { method = 'GET', cookie, body, tolerate = [] } = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const wait = PACE_MS - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();

    const res = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      // Retry-After is in seconds; the auth window is a minute wide, so a
      // missing header means waiting out most of one.
      const after = Number(res.headers.get('retry-after')) || 20;
      console.log(`   rate limited, waiting ${after}s…`);
      await sleep(after * 1000);
      continue;
    }
    if (!res.ok) {
      // Only read the body on failure: a tolerated response is never used for
      // anything but its status, and the success path must keep its stream.
      const text = await res.text();
      if (!tolerated(tolerate, res.status, text)) {
        throw new Error(`${method} ${path} -> ${res.status} ${text}`);
      }
    }
    return res;
  }
  throw new Error(`${method} ${path}: still rate limited after ${MAX_RETRIES} retries`);
}

const cookiesOf = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

/** Registers the account, or logs in if a previous run already made it. */
async function ensureUser(username) {
  const credentials = { email: `${username}@example.com`, password: PASSWORD };

  const created = await call('/auth/register', {
    method: 'POST',
    body: { username, ...credentials },
    tolerate: [409],
  });

  const res = created.status === 409
    ? await call('/auth/login', { method: 'POST', body: credentials })
    : created;

  const cookie = cookiesOf(res);
  const me = await (await call('/users/me', { cookie })).json();
  // The envelope is { success, message, data } (successResponse in response.utils.ts).
  const id = me.data?.id ?? me.id;
  return { username, id, cookie, existed: created.status === 409 };
}

const users = [];
step(`Creating ${USERS} users`);
for (let i = 1; i <= USERS; i++) {
  const user = await ensureUser(`${PREFIX}${i}`);
  users.push(user);
  console.log(`   ${user.username} (id ${user.id})${user.existed ? ' — already existed' : ''}`);
}

step('Completing onboarding');
for (const [index, user] of users.entries()) {
  const camp = index % 2;
  const movieIds = [
    ...MOVIES.filter((m) => m.group === camp).map((m) => m.id),
    ...ONBOARDING_FILLER,
  ];
  // 409 is "already completed" — the normal answer on a rerun.
  await call('/users/me/onboarding', {
    method: 'POST',
    cookie: user.cookie,
    body: { movieIds },
    tolerate: [409],
  });
  console.log(`   ${user.username}: ${movieIds.length} picks`);
}

step('Building the friend mesh');
let friendships = 0;
for (let i = 0; i < users.length; i++) {
  for (let j = i + 1; j < users.length; j++) {
    // On a rerun both routes report the existing friendship as 400, not 409, so
    // the message has to be matched to tell that apart from a real bad request.
    const already = { status: 400, message: /already/i };
    await call(`/friends/${users[j].id}`, {
      method: 'POST',
      cookie: users[i].cookie,
      tolerate: [409, already],
    });
    await call(`/friends/${users[i].id}/accept`, {
      method: 'PATCH',
      cookie: users[j].cookie,
      tolerate: [404, 409, already],
    });
    friendships++;
    console.log(`   ${users[i].username} <-> ${users[j].username}`);
  }
}

step('Recording trailer reactions');
let reactions = 0;
for (const [index, user] of users.entries()) {
  // Two taste camps that disagree on every film. A block structure like this is
  // something SVD can actually find; random likes would just be noise.
  const camp = index % 2;
  for (const movie of MOVIES) {
    const reaction = movie.group === camp ? 'like' : 'dislike';
    // A reaction is permanent by design, so a rerun answers 409. That is a
    // success for seeding: the row is there.
    await call(`/movies/${movie.id}/rating`, {
      method: 'POST',
      cookie: user.cookie,
      body: { reaction },
      tolerate: [409],
    });
    reactions++;
  }
  console.log(`   ${user.username}: ${MOVIES.length} reactions (camp ${camp})`);
}

console.log(
  `\nDone. ${users.length} users, ${friendships} friendships, ${reactions} reactions ` +
    `across ${MOVIES.length} movies.`,
);
console.log(`Log in as ${PREFIX}1@example.com / ${PASSWORD}`);
console.log('Now run: npm run retrain');
