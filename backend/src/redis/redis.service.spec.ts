import { MetricsService } from 'src/metrics/metrics.service';
import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('RedisService', () => {
  let service: RedisService;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
        MetricsService,
      ],
    }).compile();
    service = module.get<RedisService>(RedisService);
    warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('returns the cached value from the client', async () => {
      mockRedisClient.get.mockResolvedValue('cached-value');

      await expect(service.get('some:key')).resolves.toBe('cached-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('some:key');
    });

    it('returns null and logs a warning when the client fails', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('connection refused'));

      await expect(service.get('some:key')).resolves.toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('stores the value with the TTL as an EX option', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('some:key', 'value', 3600);

      expect(mockRedisClient.set).toHaveBeenCalledWith('some:key', 'value', { EX: 3600 });
    });

    it('swallows the error and logs a warning when the client fails', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('connection refused'));

      await expect(service.set('some:key', 'value', 3600)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
