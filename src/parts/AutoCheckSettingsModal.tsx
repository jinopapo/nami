import { useState, type ReactNode } from 'react';

type SettingsTab = 'autoApproval' | 'autoCheck';

type AutoCheckSettingsModalProps = {
  isOpen: boolean;
  isAvailable: boolean;
  workspaceLabel: string;
  unavailableContent: ReactNode;
  autoApprovalContent: ReactNode;
  autoCheckContent: ReactNode;
  onClose: () => void;
};

const tabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'autoApproval', label: '自動承認' },
  { key: 'autoCheck', label: '自動チェック' },
];

const getTabButtonClassName = (isActive: boolean) =>
  `flex-1 rounded-full px-3 py-2 text-sm transition ${isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`;

export default function AutoCheckSettingsModal({
  isOpen,
  isAvailable,
  workspaceLabel,
  unavailableContent,
  autoApprovalContent,
  autoCheckContent,
  onClose,
}: AutoCheckSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('autoApproval');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <section className="relative z-10 flex max-h-[min(760px,calc(100vh-32px))] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-slate-400/12 bg-[rgba(9,15,25,0.96)] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-400/10 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-slate-500">
              Settings
            </p>
            <h3 className="m-0 mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-100">
              ワークスペース設定
            </h3>
            <p className="m-0 mt-2 break-words text-sm text-slate-400">
              {workspaceLabel}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-400/14 px-3.5 py-2 text-sm text-slate-200 transition duration-150 ease-out hover:-translate-y-px"
            onClick={onClose}
          >
            閉じる
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 md:px-6 md:py-5">
          {!isAvailable ? (
            unavailableContent
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-full border border-slate-400/10 bg-slate-950/40 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={getTabButtonClassName(activeTab === tab.key)}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === 'autoApproval'
                ? autoApprovalContent
                : autoCheckContent}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
