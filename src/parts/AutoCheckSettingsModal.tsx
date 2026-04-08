type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: Array<{
    stepId: string;
    name: string;
    command: string;
    success: boolean;
    exitCode: number;
    output: string;
    ranAt: string;
  }>;
  failedStep?: {
    stepId: string;
    name: string;
    command: string;
    success: boolean;
    exitCode: number;
    output: string;
    ranAt: string;
  };
};

type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

type AutoCheckSettingsModalProps = {
  isOpen: boolean;
  isAvailable: boolean;
  workspaceLabel: string;
  enabled: boolean;
  steps: AutoCheckStep[];
  isDirty: boolean;
  isSaving: boolean;
  isRunning: boolean;
  lastResult?: AutoCheckResult;
  onClose: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onStepChange: (
    stepId: string,
    patch: { name?: string; command?: string },
  ) => void;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onSave: () => void;
  onRun: () => void;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function AutoCheckSettingsModal({
  isOpen,
  isAvailable,
  workspaceLabel,
  enabled,
  steps,
  isDirty,
  isSaving,
  isRunning,
  lastResult,
  onClose,
  onEnabledChange,
  onStepChange,
  onAddStep,
  onRemoveStep,
  onSave,
  onRun,
}: AutoCheckSettingsModalProps) {
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
              自動チェック設定
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
            <div className="rounded-[20px] border border-dashed border-slate-400/12 bg-slate-950/30 px-4 py-5 text-sm leading-6 text-slate-400">
              自動チェック設定は、ワークスペースを選択した状態で利用できます。
            </div>
          ) : (
            <div className="rounded-[20px] border border-slate-400/10 bg-slate-950/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="m-0 text-sm font-semibold text-slate-100">
                    自動チェック
                  </h4>
                  <p className="m-0 mt-1 text-xs leading-5 text-slate-400">
                    このワークスペースのタスク完了後に実行するチェックコマンドを設定します。
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => onEnabledChange(event.target.checked)}
                  />
                  有効
                </label>
              </div>

              <div className="mt-3 space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-slate-400/12 bg-slate-950/40 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="min-w-[180px] flex-1 rounded-xl border border-slate-400/12 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                        value={step.name}
                        onChange={(event) =>
                          onStepChange(step.id, { name: event.target.value })
                        }
                        placeholder={`Step ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="rounded-full border border-slate-400/12 bg-slate-400/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-60"
                        disabled={steps.length <= 1}
                        onClick={() => onRemoveStep(step.id)}
                      >
                        削除
                      </button>
                    </div>
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-2xl border border-slate-400/12 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                      value={step.command}
                      onChange={(event) =>
                        onStepChange(step.id, { command: event.target.value })
                      }
                      placeholder="例: npm run test"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-400/12 bg-slate-400/10 px-3 py-2 text-sm text-slate-300"
                  onClick={onAddStep}
                >
                  ステップを追加
                </button>
                <button
                  type="button"
                  className="rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-60"
                  disabled={!isDirty || isSaving}
                  onClick={onSave}
                >
                  {isSaving ? '保存中...' : '設定を保存'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-400/12 bg-slate-400/10 px-3 py-2 text-sm text-slate-300 disabled:opacity-60"
                  disabled={isRunning}
                  onClick={onRun}
                >
                  {isRunning ? '実行中...' : '今すぐ実行'}
                </button>
              </div>

              {lastResult ? (
                <div className="mt-3 rounded-2xl border border-slate-400/10 bg-black/20 p-3 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 ${lastResult.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                    >
                      {lastResult.success ? 'success' : 'failed'}
                    </span>
                    <span>exitCode: {lastResult.exitCode}</span>
                    <span>{formatTime(lastResult.ranAt)}</span>
                  </div>
                  <p className="m-0 mt-2 break-all text-slate-400">
                    {lastResult.command}
                  </p>
                  <div className="mt-3 space-y-2">
                    {lastResult.steps.map((step) => {
                      const isFailed =
                        lastResult.failedStep?.stepId === step.stepId;
                      return (
                        <div
                          key={step.stepId}
                          className={`rounded-xl border p-3 ${isFailed ? 'border-rose-400/20 bg-rose-950/10' : 'border-slate-400/10 bg-slate-950/50'}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-1 ${step.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                            >
                              {step.success ? 'success' : 'failed'}
                            </span>
                            <span>{step.name}</span>
                            <span>exitCode: {step.exitCode}</span>
                          </div>
                          <p className="m-0 mt-2 break-all text-slate-400">
                            {step.command}
                          </p>
                          {step.output ? (
                            <pre className="m-0 mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-rose-200">
                              {step.output}
                            </pre>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
