import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { CloudMonitoringService } from './cloud-monitoring.js';

describe('CloudMonitoringService', () => {
  let service: CloudMonitoringService;

  beforeEach(() => {
    const { context } = createContext({
      configuration: {
        workspace: { name: 'my-workspace' },
        google: { project: 'my-project' },
      },
    });
    service = context.service(CloudMonitoringService);
  });

  describe('listPoints', () => {
    it('should return points sorted by timestamp with values cast to numbers', async () => {
      const listTimeSeriesMock = jest
        .spyOn(service.client as any, 'listTimeSeries')
        .mockResolvedValue([
          [
            {
              points: [
                {
                  interval: { endTime: { seconds: 1_700_000_120 } },
                  value: { int64Value: '5' },
                },
                {
                  interval: { endTime: { seconds: 1_700_000_060 } },
                  value: { int64Value: '0' },
                },
              ],
            },
          ],
        ]);

      const actualPoints = await service.listPoints(
        'metric.type = "test"',
        new Date(1_700_000_000_000),
        new Date(1_700_000_120_000),
      );

      expect(actualPoints).toEqual([
        { timestamp: 1_700_000_060_000, value: 0 },
        { timestamp: 1_700_000_120_000, value: 5 },
      ]);
      const request = (listTimeSeriesMock.mock.calls[0] as any)[0];
      expect(request.name).toEqual('projects/my-project');
      expect(request.filter).toEqual('metric.type = "test"');
      expect(request.interval).toEqual({
        startTime: { seconds: 1_700_000_000 },
        endTime: { seconds: 1_700_000_120 },
      });
      expect(request.aggregation).toBeUndefined();
    });

    it('should include the alignment options when set', async () => {
      const listTimeSeriesMock = jest
        .spyOn(service.client as any, 'listTimeSeries')
        .mockResolvedValue([[]]);

      await service.listPoints(
        'metric.type = "test"',
        new Date(1_700_000_000_000),
        new Date(1_700_000_600_000),
        { aligner: 'ALIGN_DELTA', alignmentPeriod: 60 },
      );

      const request = (listTimeSeriesMock.mock.calls[0] as any)[0];
      expect(request.aggregation).toEqual({
        alignmentPeriod: { seconds: 60 },
        perSeriesAligner: 'ALIGN_DELTA',
      });
    });

    it('should return an empty array when no series matches', async () => {
      jest
        .spyOn(service.client as any, 'listTimeSeries')
        .mockResolvedValue([[]]);

      const actualPoints = await service.listPoints(
        'metric.type = "test"',
        new Date(1_700_000_000_000),
        new Date(1_700_000_060_000),
      );

      expect(actualPoints).toEqual([]);
    });

    it('should return an empty array when the series has no points', async () => {
      jest
        .spyOn(service.client as any, 'listTimeSeries')
        .mockResolvedValue([[{ points: undefined }]]);

      const actualPoints = await service.listPoints(
        'metric.type = "test"',
        new Date(1_700_000_000_000),
        new Date(1_700_000_060_000),
      );

      expect(actualPoints).toEqual([]);
    });
  });
});
