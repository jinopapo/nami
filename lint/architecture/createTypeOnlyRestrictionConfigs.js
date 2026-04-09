const TEST_FILE_IGNORES = ['**/*.test.ts', '**/*.test.tsx'];

const TYPE_ONLY_RESTRICTION_MESSAGES = [
  {
    selector: "ExportNamedDeclaration[source!=null][exportKind!='type']",
    message: '値の re-export は禁止です。型のみを定義してください。',
  },
  {
    selector: "ExportAllDeclaration[exportKind!='type']",
    message: '値の export は禁止です。型のみを定義してください。',
  },
  {
    selector: 'ExportDefaultDeclaration',
    message: 'default export は禁止です。型のみを定義してください。',
  },
  {
    selector: 'TSExportAssignment',
    message: 'export assignment は禁止です。型のみを定義してください。',
  },
  {
    selector: 'VariableDeclaration',
    message: '変数定義は禁止です。型のみを定義してください。',
  },
  {
    selector: 'FunctionDeclaration',
    message: '関数定義は禁止です。型のみを定義してください。',
  },
  {
    selector: 'ClassDeclaration',
    message: 'クラス定義は禁止です。型のみを定義してください。',
  },
  {
    selector: 'TSEnumDeclaration',
    message: 'enum 定義は禁止です。型のみを定義してください。',
  },
];

/**
 * @param {string[]} directories
 */
export function createTypeOnlyRestrictionConfigs(directories) {
  return directories.map((directory) => {
    const normalizedDirectory = directory.replace(/\/+$/, '');

    return {
      files: [`${normalizedDirectory}/**/*.{ts,tsx}`],
      ignores: TEST_FILE_IGNORES,
      rules: {
        'no-restricted-syntax': [
          'error',
          ...TYPE_ONLY_RESTRICTION_MESSAGES.map(({ selector, message }) => ({
            selector,
            message: `${normalizedDirectory} では${message}`,
          })),
        ],
      },
    };
  });
}
