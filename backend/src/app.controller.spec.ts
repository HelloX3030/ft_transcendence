import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppService: Partial<jest.Mocked<AppService>> = {
      getDbTime: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get(AppService);
  });

  describe('ping', () => {
    it('returns { message: "pong", db_time } from AppService', async () => {
      const fakeDate = new Date('2024-01-01T00:00:00.000Z');
      appService.getDbTime.mockResolvedValue(fakeDate);

      const result = await appController.ping();

      expect(result).toEqual({ message: 'pong', db_time: fakeDate });
      expect(appService.getDbTime).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from AppService.getDbTime', async () => {
      appService.getDbTime.mockRejectedValue(new Error('DB unavailable'));

      await expect(appController.ping()).rejects.toThrow('DB unavailable');
    });
  });
});
