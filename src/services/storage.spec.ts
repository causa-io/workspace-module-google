import { File, Storage } from '@google-cloud/storage';
import { InvalidCloudStorageUriError } from './storage.errors.js';
import { CloudStorageService } from './storage.js';

describe('CloudStorageService', () => {
  let service: CloudStorageService;

  beforeEach(() => {
    service = new CloudStorageService();
  });

  describe('storage', () => {
    it('should expose a Storage instance', () => {
      expect(service.storage).toBeInstanceOf(Storage);
    });
  });

  describe('parseGsUri', () => {
    it('should throw an error if the URI is not a valid Google Cloud Storage URI', () => {
      expect(() => service.parseGsUri('https://example.com')).toThrow(
        InvalidCloudStorageUriError,
      );
    });

    it('should return the bucket and path', () => {
      const actual = service.parseGsUri('gs://my-bucket/my/path');

      expect(actual).toEqual({ bucket: 'my-bucket', path: 'my/path' });
    });
  });

  describe('getFileFromGsUri', () => {
    it('should return the file', () => {
      const actual = service.getFileFromGsUri('gs://my-bucket/my/path');

      expect(actual).toBeInstanceOf(File);
      expect(actual.bucket.name).toEqual('my-bucket');
      expect(actual.name).toEqual('my/path');
    });
  });
});
