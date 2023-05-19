import { ConfigurationValueNotFoundError } from '@causa/workspace/configuration';
import { createContext } from '@causa/workspace/testing';
import { ServiceUsageClient } from '@google-cloud/service-usage';
import { jest } from '@jest/globals';
import 'jest-extended';
import { GoogleServicesEnable } from './google-services-enable.js';

describe('GoogleServicesEnable', () => {
  let mockEnableServices: jest.SpiedFunction<(...args: any[]) => any>;

  beforeEach(() => {
    mockEnableServices = jest.spyOn(
      ServiceUsageClient.prototype,
      'batchEnableServices',
    );
    mockEnableServices.mockResolvedValue([
      { promise: () => Promise.resolve() },
    ]);
  });

  it('should throw if the project is not defined', async () => {
    const { context } = createContext({
      configuration: { google: { services: ['service-a', 'service-b'] } },
      functions: [GoogleServicesEnable],
    });

    const actualPromise = context.call(GoogleServicesEnable, {});

    await expect(actualPromise).rejects.toThrow(
      ConfigurationValueNotFoundError,
    );
  });

  it('should enable the services', async () => {
    const { context } = createContext({
      configuration: {
        google: { project: 'my-project', services: ['service-a', 'service-b'] },
      },
      functions: [GoogleServicesEnable],
    });

    const actualResult = await context.call(GoogleServicesEnable, {});

    expect(mockEnableServices).toHaveBeenCalledOnceWith({
      parent: 'projects/my-project',
      serviceIds: ['service-a', 'service-b'],
    });
    expect(actualResult).toEqual({
      configuration: {},
      services: ['service-a', 'service-b'],
    });
  });

  it('should enable the services in batches', async () => {
    const expectedServices = [...new Array(22)].map((_, i) => `service-${i}`);
    const { context } = createContext({
      configuration: {
        google: { project: 'my-project', services: expectedServices },
      },
      functions: [GoogleServicesEnable],
    });

    const actualResult = await context.call(GoogleServicesEnable, {});

    expect(mockEnableServices).toHaveBeenCalledTimes(2);
    expect(mockEnableServices).toHaveBeenCalledWith({
      parent: 'projects/my-project',
      serviceIds: expectedServices.slice(0, 20),
    });
    expect(mockEnableServices).toHaveBeenCalledWith({
      parent: 'projects/my-project',
      serviceIds: expectedServices.slice(20),
    });
    expect(actualResult).toEqual({
      configuration: {},
      services: expectedServices,
    });
  });

  it('should skip if no services are defined and return the configuration', async () => {
    const { context } = createContext({
      configuration: { google: { project: 'my-project' } },
      functions: [GoogleServicesEnable],
    });

    const actualResult = await context.call(GoogleServicesEnable, {});

    expect(mockEnableServices).not.toHaveBeenCalled();
    expect(actualResult).toEqual({
      configuration: { google: { services: [] } },
      services: [],
    });
  });

  it('should not enable services during tear down', async () => {
    const { context } = createContext({
      configuration: {
        google: { project: 'my-project', services: ['service-a', 'service-b'] },
      },
      functions: [GoogleServicesEnable],
    });

    const actualResult = await context.call(GoogleServicesEnable, {
      tearDown: true,
    });

    expect(actualResult).toEqual({
      configuration: {},
      services: [],
    });
    expect(mockEnableServices).not.toHaveBeenCalled();
  });
});
