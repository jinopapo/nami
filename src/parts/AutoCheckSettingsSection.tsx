type AutoCheckStep = { id: string; name: string; command: string };
type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};
type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

type AutoCheckSettingsSectionProps = {
  enabled: boolean;
  steps: AutoCheckStep[];
  isDirty: boolean;
  isSaving: boolean;
  isRunning: boolean;
  lastResult?: AutoCheckResult;
  onEnabledChange: (enabled: boolean) => void;
  onStepChange: (
    stepId: string,
    patch: Partial<Pick<AutoCheckStep, 'name' | 'command'>>,
  ) => void;
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onSave: () => void;
  onRun: () => void;
};

const description =
  'このワークスペースのタスク完了後に実行するチェックコマンドを設定します。';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const getStatusBadgeClassName = (success: boolean) =>
  success
    ? 'bg-emerald-500/15 text-emerald-300'
    : 'bg-rose-500/15 text-rose-300';

function AutoCheckStepEditor({
  step,
  index,
  canRemove,
  onStepChange,
  onRemoveStep,
}: {
  step: AutoCheckStep;
  index: number;
  canRemove: boolean;
  onStepChange: AutoCheckSettingsSectionProps['onStepChange'];
  onRemoveStep: AutoCheckSettingsSectionProps['onRemoveStep'];
}) {
  return (
    <div className="rounded-2xl border border-slate-400/12 bg-slate-950/40 p-3">
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
          disabled={!canRemove}
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
  );
}

function AutoCheckResultPanel({ lastResult }: { lastResult: AutoCheckResult }) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-400/10 bg-black/20 p-3 text-xs text-slate-300">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 ${getStatusBadgeClassName(lastResult.success)}`}
        >
          {lastResult.success ? 'success' : 'failed'}
        </span>
        <span>exitCode: {lastResult.exitCode}</span>
        <span>{formatTime(lastResult.ranAt)}</span>
      </div>
      <p className="m-0 mt-2 break-all text-slate-400">{lastResult.command}</p>
      <div className="mt-3 space-y-2">
        {lastResult.steps.map((step) => {
          const isFailed = lastResult.failedStep?.stepId === step.stepId;
          return (
            <div
              key={step.stepId}
              className={`rounded-xl border p-3 ${isFailed ? 'border-rose-400/20 bg-rose-950/10' : 'border-slate-400/10 bg-slate-950/50'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 ${getStatusBadgeClassName(step.success)}`}
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
  );
}

export default function AutoCheckSettingsSection({
  enabled,
  steps,
  isDirty,
  isSaving,
  isRunning,
  lastResult,
  onEnabledChange,
  onStepChange,
  onAddStep,
  onRemoveStep,
  onSave,
  onRun,
}: AutoCheckSettingsSectionProps) {
  return (
    <div className="rounded-[20px] border border-slate-400/10 bg-slate-950/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="m-0 text-sm font-semibold text-slate-100">
            自動チェック
          </h4>
          <p className="m-0 mt-1 text-xs leading-5 text-slate-400">
            {description}
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
          <AutoCheckStepEditor
            key={step.id}
            step={step}
            index={index}
            canRemove={steps.length > 1}
            onStepChange={onStepChange}
            onRemoveStep={onRemoveStep}
          />
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
      {lastResult ? <AutoCheckResultPanel lastResult={lastResult} /> : null}
    </div>
  );
}
