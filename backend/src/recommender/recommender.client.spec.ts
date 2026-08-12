import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecommenderClient } from './recommender.client';

process.env.RECOMMENDER_URL = 'http://recommender:8000';

function mockFetchWith(body: unknown, ok = true, status = ok ? 200 : 500): void {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('RecommenderClient', () => {
  let client: RecommenderClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecommenderClient],
    }).compile();
    client = module.get<RecommenderClient>(RecommenderClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('feed', () => {
    it('posts the recommender wire format and returns the ids in order', async () => {
      mockFetchWith([
        { movie_id: 550, score: 0.9 },
        { movie_id: 13, score: 0.4 },
      ]);

      const ids = await client.feed(42, 20);

      expect(ids).toEqual([550, 13]);
      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        'http://recommender:8000/feed',
        expect.objectContaining({
          method: 'POST',
          // user_id is a string on the wire; the service converts it back.
          body: JSON.stringify({ user_id: '42', limit: 20 }),
        }),
      );
    });

    it('turns a non-2xx response into a service-unavailable error', async () => {
      mockFetchWith({}, false);
      jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.feed(42, 20)).rejects.toThrow(ServiceUnavailableException);
    });

    it('turns a network error or timeout into a service-unavailable error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
      jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.feed(42, 20)).rejects.toThrow(ServiceUnavailableException);
    });

    it('aborts a hung connection rather than holding the request open', async () => {
      mockFetchWith([]);

      await client.feed(42, 20);

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });
  });

  describe('signal', () => {
    it('sends the TMDB id and returns nothing awaitable', () => {
      mockFetchWith(null, true, 204);

      expect(client.signal(42, 550, 'like')).toBeUndefined();
      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        'http://recommender:8000/signal',
        expect.objectContaining({
          body: JSON.stringify({ user_id: '42', movie_id: 550, action: 'like' }),
        }),
      );
    });

    // An unhandled rejection is fatal in Node, so this one protects the process
    // rather than any user-visible behaviour.
    it('never rejects when the recommender is down', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
      const warn = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      client.signal(42, 550, 'dislike');
      // Let the rejection settle; an unhandled one would fail the suite here.
      await new Promise((resolve) => setImmediate(resolve));

      expect(warn).toHaveBeenCalled();
    });

    // A 204 carries no body, and res.json() throws on an empty one — which would
    // be logged as a failure that never happened.
    it('treats the 204 answer as success', async () => {
      mockFetchWith(null, true, 204);
      const warn = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      client.signal(42, 550, 'like');
      await new Promise((resolve) => setImmediate(resolve));

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
