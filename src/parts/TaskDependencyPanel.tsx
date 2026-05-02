type DependencyOption = {
  taskId: string;
  label: string;
  description: string;
};

type TaskDependencyPanelProps = {
  title: string;
  description: string;
  badgeLabel: string;
  options: DependencyOption[];
  selectedTaskIds: string[];
  emptyMessage: string;
  disabled?: boolean;
  disabledMessage?: string;
  saveLabel?: string;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
  onToggle: (taskId: string) => void;
  onSave?: () => void;
};

export default function TaskDependencyPanel({
  title,
  description,
  badgeLabel,
  options,
  selectedTaskIds,
  emptyMessage,
  disabled = false,
  disabledMessage,
  saveLabel,
  isSaving = false,
  isSaveDisabled = false,
  onToggle,
  onSave,
}: TaskDependencyPanelProps) {
  const isSaveActionDisabled = disabled || isSaveDisabled || isSaving;
  const handleSaveClick = () => {
    if (isSaveActionDisabled) {
      return;
    }

    onSave?.();
  };

  return (
    <div className="rounded-2xl border border-slate-400/10 bg-slate-950/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-medium text-slate-200">{title}</p>
          <p className="m-0 mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-xs text-slate-300">
            {badgeLabel}
          </span>
          {onSave && saveLabel ? (
            <button
              type="button"
              className="rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3 py-2 text-sm font-bold text-slate-900 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaveActionDisabled}
              onClick={handleSaveClick}
            >
              {isSaving ? '保存中...' : saveLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex max-h-52 flex-col gap-2 overflow-y-auto">
        {options.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-slate-400/12 px-3 py-3 text-sm text-slate-500">
            {emptyMessage}
          </p>
        ) : (
          options.map((option) => (
            <label
              key={option.taskId}
              className="flex items-start gap-3 rounded-xl border border-slate-400/10 bg-slate-950/35 px-3 py-3 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                checked={selectedTaskIds.includes(option.taskId)}
                disabled={disabled}
                onChange={() => onToggle(option.taskId)}
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      {disabledMessage ? (
        <p className="m-0 mt-3 text-xs text-slate-500">{disabledMessage}</p>
      ) : null}
    </div>
  );
}
