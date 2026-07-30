import { Test, TestingModule } from '@nestjs/testing';
import type { Request as ExpressRequest } from 'express';
import { UpdateUserDto } from './dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUsersService = {
  getMe: jest.fn(),
  updateMe: jest.fn(),
  deleteMe: jest.fn(),
  getUser: jest.fn(),
  searchUsers: jest.fn(),
  uploadAvatar: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

function mockRequest(sub: number): ExpressRequest {
  return { user: { sub, email: 'test@example.com' } } as ExpressRequest;
}

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('delegates to usersService.getMe with the JWT subject', async () => {
      const profile = { id: 42, username: 'test', email: 'test@example.com' };
      mockUsersService.getMe.mockResolvedValue(profile);

      const result = await controller.getMe(mockRequest(42));

      expect(mockUsersService.getMe).toHaveBeenCalledWith(42);
      expect(result).toEqual(profile);
    });
  });

  describe('updateMe', () => {
    it('delegates to usersService.updateMe with the JWT subject and dto', async () => {
      const dto: UpdateUserDto = { username: 'newname' };
      const updated = { id: 42, username: 'newname', email: 'test@example.com' };
      mockUsersService.updateMe.mockResolvedValue(updated);

      const result = await controller.updateMe(mockRequest(42), dto);

      expect(mockUsersService.updateMe).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(updated);
    });
  });

  describe('deleteMe', () => {
    it('delegates to usersService.deleteMe with the JWT subject', async () => {
      mockUsersService.deleteMe.mockResolvedValue({ message: 'Account deleted' });

      const result = await controller.deleteMe(mockRequest(42));

      expect(mockUsersService.deleteMe).toHaveBeenCalledWith(42);
      expect(result).toEqual({ message: 'Account deleted' });
    });
  });

  describe('searchUsers', () => {
    it('delegates to usersService.searchUsers with the JWT subject and query dto', async () => {
      const dto = { query: 'ali', page: 1, limit: 20 };
      const response = {
        page: 1,
        limit: 20,
        total: 1,
        results: [{ id: 7, username: 'alice', avatarFileId: null }],
      };
      mockUsersService.searchUsers.mockResolvedValue(response);

      const result = await controller.searchUsers(mockRequest(42), dto);

      expect(mockUsersService.searchUsers).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(response);
    });
  });

  describe('getUser', () => {
    it('delegates to usersService.getUser with the route param id', async () => {
      const publicProfile = { id: 7, username: 'other', avatarFileId: null };
      mockUsersService.getUser.mockResolvedValue(publicProfile);

      const result = await controller.getUser(7);

      expect(mockUsersService.getUser).toHaveBeenCalledWith(7);
      expect(result).toEqual(publicProfile);
    });
  });
});
