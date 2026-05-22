/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AutoCheckSettingsModal from './AutoCheckSettingsModal';

const renderModal = (
  props: Partial<Parameters<typeof AutoCheckSettingsModal>[0]> = {},
) =>
  renderToStaticMarkup(
    <AutoCheckSettingsModal
      isOpen
      isAvailable
      workspaceLabel="~/repo"
      unavailableContent={
        <div>設定は、ワークスペースを選択した状態で利用できます。</div>
      }
      autoApprovalContent={<div>自動承認の設定内容</div>}
      autoCheckContent={<div>自動チェックの設定内容</div>}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('AutoCheckSettingsModal', () => {
  it('renders nothing when closed', () => {
    expect(renderModal({ isOpen: false })).toBe('');
  });

  it('shows unavailable message when no workspace is selected', () => {
    const html = renderModal({ isAvailable: false });

    expect(html).toContain(
      '設定は、ワークスペースを選択した状態で利用できます。',
    );
  });

  it('shows auto approval settings by default without model tab', () => {
    const html = renderModal();

    expect(html).toContain('ワークスペース設定');
    expect(html).not.toContain('モデル');
    expect(html).toContain('自動承認');
    expect(html).toContain('自動承認の設定内容');
  });
});
