const TEST_FILE_IGNORES = ['**/*.test.ts', '**/*.test.tsx'];

/**
 * @param {string[]} directories
 */
export function createSameLayerRestrictionConfigs(directories) {
  return directories.map((directory) => {
    const normalizedDirectory = directory.replace(/\/+$/, '');
    const layerName =
      normalizedDirectory.split('/').at(-1) ?? normalizedDirectory;

    return {
      files: [`${normalizedDirectory}/**/*.{ts,tsx}`],
      ignores: TEST_FILE_IGNORES,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['./*', `**/${layerName}/**`],
                message: `同レイヤー（${normalizedDirectory}）への依存は禁止です。`,
              },
            ],
          },
        ],
      },
    };
  });
}
