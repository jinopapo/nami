import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuiltinTools, getCoreBuiltinToolCatalog } from '@cline/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedDir = path.join(__dirname, 'generated');
const temporaryWorkspacePrefix = path.join(os.tmpdir(), 'nami-cline-tool-');

const toPosix = (targetPath) => targetPath.split(path.sep).join('/');

const ensureCleanDir = async (dirPath) => {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
};

const readFileIfExists = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
};

const createWorkspaceFile = async (workspaceDir, relativePath, content) => {
  const absolutePath = path.join(workspaceDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return absolutePath;
};

const withWorkspace = async (workspaceDir, execute) => {
  const previousCwd = process.cwd();
  process.chdir(workspaceDir);
  try {
    return await execute();
  } finally {
    process.chdir(previousCwd);
  }
};

const createContext = (workspaceDir) => ({
  agentId: 'nami-built-in-tool-survey',
  conversationId: 'nami-built-in-tool-survey',
  iteration: 1,
  cwd: workspaceDir,
  workspace: {
    cwd: workspaceDir,
    rootPath: workspaceDir,
  },
});

const builtinTools = createBuiltinTools();

const getTool = (toolName) => {
  const tool = builtinTools.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`Built-in tool not found: ${toolName}`);
  }

  return tool;
};

const scenarios = [
  {
    id: 'read_files-basic',
    toolName: 'read_files',
    description: '範囲指定ありの read_files',
    workspaceName: 'read-files-basic',
    async prepare(workspaceDir) {
      const filePath = await createWorkspaceFile(
        workspaceDir,
        'notes/info.txt',
        'FIRST_LINE\nSECOND_LINE\nTHIRD_LINE\n',
      );
      return {
        input: {
          files: [
            {
              path: filePath,
              start_line: 1,
              end_line: 2,
            },
          ],
        },
      };
    },
    async verify(workspaceDir) {
      return {
        fileContent: await readFileIfExists(path.join(workspaceDir, 'notes/info.txt')),
      };
    },
  },
  {
    id: 'search_codebase-basic',
    toolName: 'search_codebase',
    description: '単一クエリの search_codebase',
    workspaceName: 'search-codebase-basic',
    async prepare(workspaceDir) {
      await createWorkspaceFile(
        workspaceDir,
        'src/a.ts',
        'export const token = "SEARCH_TARGET_TOKEN";\n',
      );
      await createWorkspaceFile(workspaceDir, 'src/b.ts', 'export const other = 1;\n');
      return {
        input: {
          queries: ['SEARCH_TARGET_TOKEN'],
        },
      };
    },
    async verify(workspaceDir) {
      return {
        files: [
          await readFileIfExists(path.join(workspaceDir, 'src/a.ts')),
          await readFileIfExists(path.join(workspaceDir, 'src/b.ts')),
        ],
      };
    },
  },
  {
    id: 'run_commands-basic',
    toolName: 'run_commands',
    description: '単一コマンドの run_commands',
    workspaceName: 'run-commands-basic',
    async prepare(workspaceDir) {
      await createWorkspaceFile(workspaceDir, 'marker.txt', 'workspace-marker\n');
      return {
        input: {
          commands: ["printf 'RUN_COMMANDS_OK\\n'"],
        },
      };
    },
    async verify(workspaceDir) {
      return {
        fileContent: await readFileIfExists(path.join(workspaceDir, 'marker.txt')),
      };
    },
  },
  {
    id: 'fetch_web_content-basic',
    toolName: 'fetch_web_content',
    description: 'example.com に対する fetch_web_content',
    workspaceName: 'fetch-web-content-basic',
    async prepare() {
      return {
        input: {
          requests: [
            {
              url: 'https://example.com',
              prompt: 'Return the page title only.',
            },
          ],
        },
      };
    },
    async verify() {
      return {};
    },
  },
  {
    id: 'editor-create',
    toolName: 'editor',
    description: '存在しないファイルを editor で新規作成',
    workspaceName: 'editor-create',
    async prepare(workspaceDir) {
      const filePath = path.join(workspaceDir, 'editor-output.txt');
      return {
        input: {
          path: filePath,
          new_text: 'EDITOR_FIRST_LINE\nEDITOR_SECOND_LINE\n',
        },
      };
    },
    async verify(workspaceDir) {
      return {
        fileContent: await readFileIfExists(
          path.join(workspaceDir, 'editor-output.txt'),
        ),
      };
    },
  },
  {
    id: 'editor-replace',
    toolName: 'editor',
    description: '既存テキスト置換の editor',
    workspaceName: 'editor-replace',
    async prepare(workspaceDir) {
      const filePath = await createWorkspaceFile(
        workspaceDir,
        'replace-target.txt',
        'alpha\nBEFORE_VALUE\nomega\n',
      );
      return {
        input: {
          path: filePath,
          old_text: 'BEFORE_VALUE',
          new_text: 'AFTER_VALUE',
        },
      };
    },
    async verify(workspaceDir) {
      return {
        fileContent: await readFileIfExists(
          path.join(workspaceDir, 'replace-target.txt'),
        ),
      };
    },
  },
  {
    id: 'editor-insert',
    toolName: 'editor',
    description: 'insert_line 指定の editor',
    workspaceName: 'editor-insert',
    async prepare(workspaceDir) {
      const filePath = await createWorkspaceFile(
        workspaceDir,
        'insert-target.txt',
        'line1\nline3\n',
      );
      return {
        input: {
          path: filePath,
          new_text: 'line2\n',
          insert_line: 2,
        },
      };
    },
    async verify(workspaceDir) {
      return {
        fileContent: await readFileIfExists(
          path.join(workspaceDir, 'insert-target.txt'),
        ),
      };
    },
  },
];

const runScenario = async (scenario, temporaryWorkspaceRootDir) => {
  const workspaceDir = path.join(temporaryWorkspaceRootDir, scenario.workspaceName);
  await ensureCleanDir(workspaceDir);
  const { input } = await scenario.prepare(workspaceDir);
  const tool = getTool(scenario.toolName);
  const context = createContext(workspaceDir);

  const rawOutput = await withWorkspace(workspaceDir, () =>
    tool.execute(input, context),
  );
  const verification = await scenario.verify(workspaceDir);

  return {
    id: scenario.id,
    toolName: scenario.toolName,
    description: scenario.description,
    workspaceDir: toPosix(workspaceDir),
    rawInput: input,
    rawOutput,
    verification,
  };
};

const main = async () => {
  await fs.mkdir(generatedDir, { recursive: true });
  const scenarioArg = process.argv[2];
  const selectedScenarioIds = scenarioArg
    ? new Set(scenarioArg.split(',').map((entry) => entry.trim()).filter(Boolean))
    : undefined;

  const selectedScenarios = selectedScenarioIds
    ? scenarios.filter((scenario) => selectedScenarioIds.has(scenario.id))
    : scenarios;

  if (selectedScenarios.length === 0) {
    throw new Error('No scenarios selected.');
  }

  const temporaryWorkspaceRootDir = await fs.mkdtemp(temporaryWorkspacePrefix);

  try {
    const results = [];
    for (const scenario of selectedScenarios) {
      results.push(await runScenario(scenario, temporaryWorkspaceRootDir));
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      toolCatalog: getCoreBuiltinToolCatalog(),
      scenarioCount: results.length,
      temporaryWorkspaceRootDir: toPosix(temporaryWorkspaceRootDir),
      scenarios: results,
    };

    const outputPath = path.join(generatedDir, 'built-in-tool-raw-io.json');
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log(`Wrote ${toPosix(outputPath)}`);
    console.log(
      JSON.stringify(
        {
          generatedAt: payload.generatedAt,
          scenarioCount: payload.scenarioCount,
          tools: results.map((scenario) => ({
            id: scenario.id,
            toolName: scenario.toolName,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await fs.rm(temporaryWorkspaceRootDir, { recursive: true, force: true });
  }
};

await main();