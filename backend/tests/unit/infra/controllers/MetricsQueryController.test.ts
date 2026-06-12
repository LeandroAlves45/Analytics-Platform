/**
 * Testes unitários para MetricsQueryController.
 */

import { Response, NextFunction } from 'express';
import { MetricsQueryController } from '@infra/controllers/MetricsQueryController';
import { QueryAggregatedMetricsUseCase } from '@application/usecases/metrics/QueryAggregatedMetricsUseCase';
import type { AuthenticatedRequest } from '@infra/controllers/authenticatedRequest';
import { UnauthorizedError } from '@shared/errors';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

const originalNodeEnv = process.env.NODE_ENV;

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('MetricsQueryController', () => {
  let controller: MetricsQueryController;
  let mockUseCase: jest.Mocked<Pick<QueryAggregatedMetricsUseCase, 'execute'>>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn().mockResolvedValue({
        workspaceId: TEST_WORKSPACE_ID,
        interval: '5m',
        from: new Date('2026-06-01T10:00:00.000Z'),
        to: new Date('2026-06-01T11:00:00.000Z'),
        series: [],
      }),
    };
    controller = new MetricsQueryController(
      mockUseCase as unknown as QueryAggregatedMetricsUseCase
    );
    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should respond 422 when interval is missing', async () => {
    const req = {
      query: {
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-01T11:00:00.000Z',
      },
      workspaceId: TEST_WORKSPACE_ID,
    } as unknown as AuthenticatedRequest;
    const res = createMockResponse();

    await controller.getAggregated(req, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('should respond 200 with ISO date strings in series', async () => {
    mockUseCase.execute.mockResolvedValue({
      workspaceId: TEST_WORKSPACE_ID,
      interval: '5m',
      from: new Date('2026-06-01T10:00:00.000Z'),
      to: new Date('2026-06-01T11:00:00.000Z'),
      series: [
        {
          time: new Date('2026-06-01T10:00:00.000Z'),
          endpoint: '/api/users',
          method: 'GET',
          count: 10,
          latencyP50: 1,
          latencyP75: 1,
          latencyP95: 1,
          latencyP99: 1,
          latencyAvg: 1,
          latencyMin: 1,
          latencyMax: 1,
          status2xxCount: 10,
          status3xxCount: 0,
          status4xxCount: 0,
          status5xxCount: 0,
          errorRate: 0,
          throughputPerSec: 10 / 300,
        },
      ],
    });
    const req = {
      query: {
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-01T11:00:00.000Z',
        interval: '5m',
      },
      workspaceId: TEST_WORKSPACE_ID,
    } as unknown as AuthenticatedRequest;
    const res = createMockResponse();

    await controller.getAggregated(req, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({ time: '2026-06-01T10:00:00.000Z' }),
          ]),
        }),
      })
    );
  });

  it('should call next with UnauthorizedError in production without auth context', async () => {
    process.env.NODE_ENV = 'production';

    const req = {
      query: {
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-01T11:00:00.000Z',
        interval: '5m',
      },
    } as unknown as AuthenticatedRequest;
    const res = createMockResponse();

    await controller.getAggregated(req, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
