import boundaries from 'eslint-plugin-boundaries';

const architectureElements = [
  {
    type: 'core',
    pattern: 'core/**/*',
    mode: 'full',
  },
  {
    type: 'electron_entity',
    pattern: 'electron/entity/**/*',
    mode: 'full',
  },
  {
    type: 'electron_ipc',
    pattern: 'electron/ipc/**/*',
    mode: 'full',
  },
  {
    type: 'electron_repository',
    pattern: 'electron/repository/**/*',
    mode: 'full',
  },
  {
    type: 'electron_service',
    pattern: 'electron/service/**/*',
    mode: 'full',
  },
  {
    type: 'src_action',
    pattern: 'src/action/**/*',
    mode: 'full',
  },
  {
    type: 'src_app_tsx',
    pattern: 'src/App.tsx',
    mode: 'full',
  },
  {
    type: 'src_component',
    pattern: 'src/component/**/*',
    mode: 'full',
  },
  {
    type: 'src_model',
    pattern: 'src/model/**/*',
    mode: 'full',
  },
  {
    type: 'src_parts',
    pattern: 'src/parts/**/*',
    mode: 'full',
  },
  {
    type: 'src_repository',
    pattern: 'src/repository/**/*',
    mode: 'full',
  },
  {
    type: 'src_service',
    pattern: 'src/service/**/*',
    mode: 'full',
  },
  {
    type: 'src_store',
    pattern: 'src/store/**/*',
    mode: 'full',
  },
];

const architectureRules = [
  {
    from: 'core',
    allow: ['core'],
  },
  {
    from: 'electron_entity',
    allow: [],
  },
  {
    from: 'electron_ipc',
    allow: ['core', 'electron_service'],
  },
  {
    from: 'electron_repository',
    allow: ['electron_entity'],
  },
  {
    from: 'electron_service',
    allow: ['electron_entity', 'electron_repository'],
  },
  {
    from: 'src_action',
    allow: ['src_model', 'src_service', 'src_store'],
  },
  {
    from: 'src_app_tsx',
    allow: ['src_component'],
  },
  {
    from: 'src_component',
    allow: ['src_action', 'src_model', 'src_parts'],
  },
  {
    from: 'src_model',
    allow: [],
  },
  {
    from: 'src_parts',
    allow: [],
  },
  {
    from: 'src_repository',
    allow: ['core', 'src_model'],
  },
  {
    from: 'src_service',
    allow: ['src_model', 'src_repository'],
  },
  {
    from: 'src_store',
    allow: ['src_model'],
  },
];

const sameLayerRestrictionConfigs = architectureElements
  .filter(
    (element) => element.pattern.endsWith('/**/*') && element.type !== 'core',
  )
  .map((element) => {
    const layerPath = element.pattern.replace('/**/*', '');
    const layerName = layerPath.split('/').at(-1) ?? layerPath;

    return {
      files: [`${layerPath}/**/*.{ts,tsx}`],
      ignores: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['./*', `**/${layerName}/**`],
                message: `同レイヤー（${element.type}）への依存は禁止です。`,
              },
            ],
          },
        ],
      },
    };
  });

const coreTypeOnlyRestrictionConfig = {
  files: ['core/**/*.{ts,tsx}'],
  ignores: ['**/*.test.ts', '**/*.test.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "ExportNamedDeclaration[source!=null][exportKind!='type']",
        message:
          'core では値の re-export は禁止です。型のみを定義してください。',
      },
      {
        selector: "ExportAllDeclaration[exportKind!='type']",
        message: 'core では値の export は禁止です。型のみを定義してください。',
      },
      {
        selector: 'ExportDefaultDeclaration',
        message:
          'core では default export は禁止です。型のみを定義してください。',
      },
      {
        selector: 'TSExportAssignment',
        message:
          'core では export assignment は禁止です。型のみを定義してください。',
      },
      {
        selector: 'VariableDeclaration',
        message: 'core では変数定義は禁止です。型のみを定義してください。',
      },
      {
        selector: 'FunctionDeclaration',
        message: 'core では関数定義は禁止です。型のみを定義してください。',
      },
      {
        selector: 'ClassDeclaration',
        message: 'core ではクラス定義は禁止です。型のみを定義してください。',
      },
      {
        selector: 'TSEnumDeclaration',
        message: 'core では enum 定義は禁止です。型のみを定義してください。',
      },
    ],
  },
};

export default [
  {
    files: ['core/**/*.{ts,tsx}', 'electron/**/*.ts', 'src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': architectureElements,
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: architectureRules,
        },
      ],
    },
  },
  coreTypeOnlyRestrictionConfig,
  ...sameLayerRestrictionConfigs,
];
