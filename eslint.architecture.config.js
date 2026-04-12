import boundaries from 'eslint-plugin-boundaries';
import { createSameLayerRestrictionConfigs } from './lint/architecture/createSameLayerRestrictionConfigs.js';
import { createTypeOnlyRestrictionConfigs } from './lint/architecture/createTypeOnlyRestrictionConfigs.js';

const architectureElements = [
  {
    type: 'share',
    pattern: 'share/**/*',
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
    type: 'electron_mapper',
    pattern: 'electron/mapper/**/*',
    mode: 'full',
  },
  {
    type: 'electron_repository',
    pattern: 'electron/repository/**/*',
    mode: 'full',
  },
  {
    type: 'electron_resource',
    pattern: 'electron/resource/**/*',
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
    from: 'share',
    allow: ['share'],
  },
  {
    from: 'electron_entity',
    allow: [],
  },
  {
    from: 'electron_ipc',
    allow: ['share', 'electron_mapper', 'electron_service'],
  },
  {
    from: 'electron_mapper',
    allow: ['share', 'electron_entity', 'electron_resource'],
  },
  {
    from: 'electron_repository',
    allow: ['electron_entity', 'electron_mapper', 'electron_resource'],
  },
  {
    from: 'electron_resource',
    allow: [],
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
    allow: ['share', 'src_model'],
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

const sameLayerRestrictedDirectories = [
  'electron/entity',
  'electron/ipc',
  'electron/mapper',
  'electron/repository',
  'electron/resource',
  'electron/service',
  'src/action',
  'src/component',
  'src/model',
  'src/parts',
  'src/repository',
  'src/service',
  'src/store',
];

const typeOnlyRestrictedDirectories = ['share', 'electron/resource'];

const sameLayerRestrictionConfigs = createSameLayerRestrictionConfigs(
  sameLayerRestrictedDirectories,
);

const typeOnlyRestrictionConfigs = createTypeOnlyRestrictionConfigs(
  typeOnlyRestrictedDirectories,
);

export default [
  {
    files: ['share/**/*.{ts,tsx}', 'electron/**/*.ts', 'src/**/*.{ts,tsx}'],
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
  ...typeOnlyRestrictionConfigs,
  ...sameLayerRestrictionConfigs,
];
