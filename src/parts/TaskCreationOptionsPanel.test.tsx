/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TaskCreationOptionsPanel from './TaskCreationOptionsPanel';

const renderPanel = (
  props: Partial<Parameters<typeof TaskCreationOptionsPanel>[0]> = {},
) =>
  renderToStaticMarkup(
    <TaskCreationOptionsPanel
      isExpanded={false}
      taskBranchName=""
      dependencyOptions={[
        {
          taskId: 'task-1',
          label: 'Task 1',
          description: 'before_start / task-1',
        },
      ]}
      selectedDependencyTaskIds={[]}
      onToggleExpanded={vi.fn()}
      onTaskBranchNameChange={vi.fn()}
      onToggleDependency={vi.fn()}
      {...props}
    />,
  );

describe('TaskCreationOptionsPanel', () => {
  it('shows only the options trigger by default', () => {
    const html = renderPanel();

    expect(html).toContain('オプション');
    expect(html).toContain(
      '作業ブランチや依存タスクを必要に応じて設定できます',
    );
    expect(html).toContain('折りたたみ');
    expect(html).toContain('rotate-0');
    expect(html).not.toContain('未指定なら task/{id} を自動生成');
    expect(html).not.toContain('0 件選択中');
  });

  it('shows branch and dependency controls when expanded', () => {
    const html = renderPanel({ isExpanded: true });

    expect(html).toContain('展開中');
    expect(html).toContain('rotate-90');
    expect(html).toContain('作業ブランチ');
    expect(html).toContain('依存タスク');
    expect(html).toContain('未指定なら task/{id} を自動生成');
    expect(html).toContain('0 件選択中');
  });

  it('shows custom branch guidance and disables dependencies when a branch is specified', () => {
    const html = renderPanel({
      isExpanded: true,
      taskBranchName: 'feature/task-1',
      isDependencyDisabled: true,
      dependencyDisabledMessage:
        'カスタムブランチを指定したタスクは依存関係を持てません。',
    });

    expect(html).toContain(
      '作業ブランチを指定したタスクはブランチを保持して PR を作成します。',
    );
    expect(html).toContain(
      'カスタムブランチを指定したタスクは依存関係を持てません。',
    );
    expect(html).toContain('disabled');
  });
});
