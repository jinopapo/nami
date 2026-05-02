/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TaskDependencyPanel from './TaskDependencyPanel';

const renderPanel = (
  props: Partial<Parameters<typeof TaskDependencyPanel>[0]> = {},
) =>
  renderToStaticMarkup(
    <TaskDependencyPanel
      title="依存タスク"
      description="依存先を選択"
      badgeLabel="1 件選択中"
      options={[
        {
          taskId: 'task-1',
          label: 'Task 1',
          description: 'before_start / task-1',
        },
      ]}
      selectedTaskIds={['task-1']}
      emptyMessage="依存先に選べる既存タスクはまだありません。"
      saveLabel="依存関係を保存"
      onToggle={vi.fn()}
      onSave={vi.fn()}
      {...props}
    />,
  );

const getSaveButtonHtml = (html: string): string =>
  html.match(/<button[^>]*>.*?<\/button>/)?.[0] ?? '';

const isButtonDisabled = (buttonHtml: string): boolean =>
  /<button(?=[^>]*\sdisabled(?:=|\s|>))[^>]*>/.test(buttonHtml);

describe('TaskDependencyPanel', () => {
  it('disables the save button when dependency editing is disabled', () => {
    const html = renderPanel({
      disabled: true,
      isSaveDisabled: false,
      isSaving: false,
    });

    expect(isButtonDisabled(getSaveButtonHtml(html))).toBe(true);
  });

  it('keeps existing save disabled states', () => {
    expect(
      isButtonDisabled(
        getSaveButtonHtml(renderPanel({ isSaveDisabled: true })),
      ),
    ).toBe(true);
    expect(
      isButtonDisabled(getSaveButtonHtml(renderPanel({ isSaving: true }))),
    ).toBe(true);
  });

  it('keeps the save button enabled when editing is allowed and changes exist', () => {
    const html = renderPanel({
      disabled: false,
      isSaveDisabled: false,
      isSaving: false,
    });

    expect(isButtonDisabled(getSaveButtonHtml(html))).toBe(false);
  });
});
