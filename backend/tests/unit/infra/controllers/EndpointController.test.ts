/**
 * Testes unitários para EndpointsController.
 */

import { Response, NextFunction } from 'express';
import { EndpointsController } from '@infra/controllers/EndpointsController';
import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('EndpointsController', () => {
  let controller: EndpointsController;
  let mockUseCase: jest.Mocked<Pick<ListActiveEndpointsUseCase, 'execute'>>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn().mockResolvedValue({
        workspaceId: TEST_WORKSPACE_ID,
        minutes: 1440,
        endpoints: [{ endpoint: '/api/users', method: 'GET' }],
      }),
    };
    controller = new EndpointsController(mockUseCase as unknown as ListActiveEndpointsUseCase);
    mockNext = jest.fn();
  });

  it('should respond 200 with endpoint list', async () => {
    const req = {
      query: {},
      workspaceId: TEST_WORKSPACE_ID,
    } as unknown as AuthenticatedRequest;
    const res = createMockResponse();

    await controller.list(req, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: TEST_WORKSPACE_ID, minutes: 1440 })
    );
  });
});
