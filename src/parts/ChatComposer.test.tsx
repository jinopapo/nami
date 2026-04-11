import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatComposer from './ChatComposer';

describe('ChatComposer', () => {
  it('shows workspace initialization feedback while creating a task', () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        draft="実装して"
        mode="plan"
        statusPhase="initializing_workspace"
        statusLabel="ワークスペース初期化中"
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(html).toContain('ワークスペース初期化中');
    expect(html).toContain('タスクワークスペースを準備しています。完了するとこのままチャットを続けられます。');
    expect(html).toContain('初期化中...');
    expect(html).toContain('タスクワークスペースを初期化しています...');
    expect(html).toContain('disabled');
  });
});