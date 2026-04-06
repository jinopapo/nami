import boundaries from 'eslint-plugin-boundaries';

const architectureElements = [
  {
    type: 'core',
    pattern: 'core/**/*',
  },
  {
    type: 'electron_entity',
    pattern: 'electron/entity/**/*',
  },
  {
    type: 'electron_ipc',
    pattern: 'electron/ipc/**/*',
  },
  {
    type: 'electron_repository',
    pattern: 'electron/repository/**/*',
  },
  {
    type: 'electron_service',
    pattern: 'electron/service/**/*',
  },
  {
    type: 'src_action',
    pattern: 'src/action/**/*',
  },
  {
    type: 'src_app_tsx',
    pattern: 'src/App.tsx',
  },
  {
    type: 'src_component',
    pattern: 'src/component/**/*',
  },
  {
    type: 'src_model',
    pattern: 'src/model/**/*',
  },
  {
    type: 'src_parts',
    pattern: 'src/parts/**/*',
  },
  {
    type: 'src_repository',
    pattern: 'src/repository/**/*',
  },
  {
    type: 'src_service',
    pattern: 'src/service/**/*',
  },
  {
    type: 'src_store',
    pattern: 'src/store/**/*',
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
];
