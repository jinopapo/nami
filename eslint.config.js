import tsParser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';

const electronLayerElements = [
  { type: 'core', pattern: 'electron/*.ts', mode: 'file' },
  { type: 'core', pattern: 'electron/core/**/*.ts', mode: 'full' },
  { type: 'service', pattern: 'electron/service/**/*.ts', mode: 'full' },
  { type: 'entity', pattern: 'electron/entity/**/*.ts', mode: 'full' },
  { type: 'repository', pattern: 'electron/repository/**/*.ts', mode: 'full' },
  { type: 'ipc', pattern: 'electron/ipc/**/*.ts', mode: 'full' },
  { type: 'shared', pattern: 'core/**/*.ts', mode: 'full' },
];

const layerNames = ['component', 'parts', 'action', 'service', 'repository', 'store', 'model'];

function createImportRestriction({ message, regexes }) {
  return [
    'error',
    {
      patterns: regexes.map((regex) => ({ regex, message })),
    },
  ];
}

function createRelativeImportDenyRegex(allowedLayers = []) {
  if (allowedLayers.length === 0) {
    return String.raw`^\.{1,2}/`;
  }

  return String.raw`^\.{1,2}/(?!.*(?:\.\./|\./)?(?:${allowedLayers.join('|')})(?:/|$)).*`;
}

function createAbsoluteImportDenyRegex(allowedLayers = [], { allowCore = false } = {}) {
  const disallowedLayers = layerNames.filter((layer) => !allowedLayers.includes(layer));
  const targets = allowCore ? [...disallowedLayers, 'core'] : disallowedLayers;

  if (targets.length === 0) {
    return null;
  }

  return String.raw`^(?:src/(?:${targets.join('|')})(?:/|$)|core(?:/|$))`;
}

function createNoFunctionDefinitionRule(message) {
  return [
    'error',
    {
      selector:
        'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, TSDeclareFunction, MethodDefinition, Property[method=true]',
      message,
    },
  ];
}

export default [
  {
    ignores: ['dist/**', 'dist-electron/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'max-lines': [
        'error',
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/App.tsx'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/App.tsx は src/component・src/action 以外を import できません。',
        regexes: [
          String.raw`^react$`,
          String.raw`^\.{1,2}/(?!component(?:/|$)|action(?:/|$)).*`,
          String.raw`^(?:src/(?!component(?:/|$)|action(?:/|$)).+|core(?:/|$))`,
        ],
      }),
    },
  },
  {
    files: ['core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'core は他レイヤーを import できません。',
        regexes: [String.raw`^src/(?:component|parts|action|service|repository|store|model)(?:/|$)`],
      }),
      'no-restricted-syntax': createNoFunctionDefinitionRule(
        'core では関数を定義できません。',
      ),
    },
  },
  {
    files: ['src/component/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/component は src/action・src/parts・src/model 以外を import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(['action', 'parts', 'model']),
          createAbsoluteImportDenyRegex(['action', 'parts', 'model']),
        ].filter(Boolean),
      }),
    },
  },
  {
    files: ['src/parts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/parts は他レイヤーを import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(),
          createAbsoluteImportDenyRegex([]),
        ].filter(Boolean),
      }),
    },
  },
  {
    files: ['src/action/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/action は src/service・src/store・src/model 以外を import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(['service', 'store', 'model']),
          createAbsoluteImportDenyRegex(['service', 'store', 'model']),
        ].filter(Boolean),
      }),
    },
  },
  {
    files: ['src/service/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/service は src/repository・src/model 以外を import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(['repository', 'model']),
          createAbsoluteImportDenyRegex(['repository', 'model']),
        ].filter(Boolean),
      }),
    },
  },
  {
    files: ['src/repository/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/repository は src/model・core 以外を import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(['model', 'core']),
          String.raw`^src/(?:component|parts|action|service|repository|store)(?:/|$)`,
        ],
      }),
    },
  },
  {
    files: ['src/store/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/model/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createImportRestriction({
        message: 'src/model は他レイヤーを import できません。同一レイヤー import も禁止です。',
        regexes: [
          createRelativeImportDenyRegex(),
          createAbsoluteImportDenyRegex([]),
        ].filter(Boolean),
      }),
      'no-restricted-syntax': createNoFunctionDefinitionRule(
        'src/model では関数を定義できません。',
      ),
    },
  },
  {
    files: ['electron/**/*.ts'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': electronLayerElements,
    },
    rules: {
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'core',
              allow: ['service', 'entity', 'repository', 'ipc', 'shared'],
            },
            {
              from: 'service',
              allow: ['entity', 'repository', 'shared'],
            },
            {
              from: 'entity',
              allow: [],
            },
            {
              from: 'repository',
              allow: ['entity', 'shared'],
            },
            {
              from: 'ipc',
              allow: ['core', 'service', 'entity', 'repository', 'shared'],
            },
            {
              from: 'shared',
              allow: [],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['electron/entity/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': createNoFunctionDefinitionRule(
        'electron/entity では関数を定義できません。',
      ),
    },
  },
];
