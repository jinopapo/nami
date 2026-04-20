/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatEventTimeline from './ChatEventTimeline';

describe('ChatEventTimeline', () => {
  it('renders message and tool read summary events', () => {
    const html = renderToStaticMarkup(
      <ChatEventTimeline
        displayItems={[
          {
            type: 'userMessage',
            id: 'message-1',
            role: 'user',
            timestamp: '2026-04-18T08:00:00.000Z',
            text: '調査して',
            status: 'sent',
          },
          {
            type: 'toolCall',
            id: 'tool-1',
            timestamp: '2026-04-18T08:01:00.000Z',
            toolKind: 'read',
            title: 'read_file',
            statusLabel: 'completed',
            toolLog: {
              toolKind: 'read',
              title: 'read_file',
              phase: 'complete',
              statusLabel: 'completed',
            },
            display: {
              variant: 'read',
              message: 'src/component/ChatPanelContainer.tsx を読み込みました',
            },
          },
        ]}
        shouldAutoScroll={false}
        autoScrollKey="session-1"
        onApproval={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(html).toContain('調査して');
    expect(html).toContain(
      'src/component/ChatPanelContainer.tsx を読み込みました',
    );
  });

  it('renders approval request actions', () => {
    const html = renderToStaticMarkup(
      <ChatEventTimeline
        displayItems={[
          {
            type: 'permissionRequest',
            id: 'approval-1',
            timestamp: '2026-04-18T08:02:00.000Z',
            approvalId: 'approval-1',
            title: 'コマンド実行の承認が必要です',
          },
        ]}
        shouldAutoScroll={false}
        autoScrollKey="session-2"
        onApproval={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(html).toContain('Approval required');
    expect(html).toContain('Approve');
    expect(html).toContain('Reject');
  });
});
