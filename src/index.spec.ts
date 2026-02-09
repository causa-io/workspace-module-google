import module from 'module';

const require = module.createRequire(import.meta.url);

const heavyModules = [
  '@firebase',
  '@google-cloud',
  'firebase',
  'firebase-admin',
  'google-auth-library',
  'google-gax',
  'googleapis',
  'quicktype-core',
];

describe('registerFunctions', () => {
  function getLoadedModules(): string[] {
    return [
      // ECMAScript modules.
      ...Object.keys((module as any)._cache),
      // CommonJS modules.
      ...Object.keys(require.cache),
    ];
  }

  it('should not import heavy modules during function registration', async () => {
    await import('./index.js');

    const actualModules = getLoadedModules();

    const actualHeavyModules = actualModules.filter((m) =>
      heavyModules.some((fm) => m.includes(fm)),
    );
    expect(actualHeavyModules).toBeEmpty();
  });
});
