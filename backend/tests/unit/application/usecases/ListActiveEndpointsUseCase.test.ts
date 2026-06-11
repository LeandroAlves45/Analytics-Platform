/**
 * Testes unitários para ListActiveEndpointsUseCase.
 */

import { ListActiveEndpointsUseCase } from '@application/usecases/metrics/ListActiveEndpointsUseCase';
import type { MetricsRepository } from '@application/contracts/repositories';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

describe('ListActiveEndpointsUseCase', () => {
  let mockMetricsRepository: jest.Mocked<Pick<MetricsRepository, 'getActiveEndpointsForWorkspace'>>;
  let useCase: ListActiveEndpointsUseCase;

  beforeEach(() => {
    mockMetricsRepository = {
      getActiveEndpointsForWorkspace: jest.fn().mockResolvedValue([
        {
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
        },
      ]),
    };
    useCase = new ListActiveEndpointsUseCase(mockMetricsRepository as unknown as MetricsRepository);
  });

  it('should return endpoints without workspaceId in each item', async () => {
    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      minutes: 1440,
    });

    expect(result.endpoints).toEqual([{ endpoint: '/api/users', method: 'GET' }]);
  });
});
