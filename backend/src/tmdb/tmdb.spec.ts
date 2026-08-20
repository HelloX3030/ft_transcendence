const apiKey = process.env.TMDB_API_KEY;

describe('TMDB API smoke test', () => {
  const skip = !apiKey;

  (skip ? it.skip : it)('validates the API key via GET /3/authentication', async () => {
    const res = await fetch('https://api.themoviedb.org/3/authentication', {
      headers: { accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  if (skip) {
    it('skipped: TMDB_API_KEY is not set in the environment', () => {
      console.warn('TMDB_API_KEY not set; skipping TMDB smoke test');
    });
  }
});
