/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatComposer from './ChatComposer';

describe('ChatComposer', () => {
  it('shows only the initialization button while creating a task', () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        draft="実装して"
        statusPhase="initializing_workspace"
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(html).toContain('初期化中...');
    expect(html).not.toContain(
      'タスクワークスペースを準備しています。完了するとこのままチャットを続けられます。',
    );
    expect(html).not.toContain('タスクワークスペースを初期化しています...');
    expect(html).toContain('disabled');
  });

  it('shows initialization feedback while transitioning from before start to planning', () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        draft=""
        statusPhase="before_start"
        decisionActions={[
          {
            key: 'start-planning',
            label: '計画を開始する',
            nextState: 'planning',
            tone: 'primary',
          },
        ]}
        isPlanningTransitionInitializing
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(html).toContain('初期化中...');
    expect(html).toContain(
      '計画を開始する準備をしています。完了まで少しお待ちください。',
    );
    expect(html).not.toContain('>計画を開始する<');
    expect(html).toContain('disabled');
  });

  it('shows retry in the primary action slot after an error', () => {
    const html = renderToStaticMarkup(
      <ChatComposer
        draft=""
        statusPhase="error"
        retryAction={{
          key: 'retry-error',
          label: '再試行する',
          nextState: 'executing',
          tone: 'primary',
        }}
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onDecisionAction={vi.fn()}
      />,
    );

    expect(html).toContain('>再試行する<');
    expect(html).not.toContain('>Stop<');
    expect(html).not.toContain('>Send<');
    expect(html).toContain(
      'エラーが発生しました。再試行するか、必要なら補足を追記して ⌘ + Enter で送信してください。',
    );
  });
});
