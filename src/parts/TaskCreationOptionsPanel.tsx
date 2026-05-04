type DependencyOption = {
  taskId: string;
  label: string;
  description: string;
};

type TaskCreationOptionsPanelProps = {
  isExpanded: boolean;
  taskBranchName: string;
  dependencyOptions: DependencyOption[];
  selectedDependencyTaskIds: string[];
  isDependencyDisabled?: boolean;
  dependencyDisabledMessage?: string;
  onToggleExpanded: () => void;
  onTaskBranchNameChange: (value: string) => void;
  onToggleDependency: (taskId: string) => void;
};

export default function TaskCreationOptionsPanel({
  isExpanded,
  taskBranchName,
  dependencyOptions,
  selectedDependencyTaskIds,
  isDependencyDisabled = false,
  dependencyDisabledMessage,
  onToggleExpanded,
  onTaskBranchNameChange,
  onToggleDependency,
}: TaskCreationOptionsPanelProps) {
  return (
    <div className="border-b border-slate-400/10 px-5 py-4 md:px-6">
      <button
        type="button"
        className="group flex w-full items-center gap-2 text-left transition hover:text-slate-100"
        aria-expanded={isExpanded}
        onClick={onToggleExpanded}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition group-hover:text-slate-200"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 12 12"
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : 'rotate-0'
            }`}
            fill="currentColor"
          >
            <path d="M4 2.25 8.5 6 4 9.75V2.25Z" />
          </svg>
        </span>
        <span className="text-sm font-medium text-slate-200">オプション</span>
      </button>

      {isExpanded ? (
        <div className="mt-3 rounded-2xl border border-slate-400/10 bg-slate-950/25 p-4">
          <div className="grid gap-4">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-xs font-medium text-slate-400">
                作業ブランチ
              </span>
              <input
                className="h-10 rounded-xl border border-slate-400/12 bg-slate-950/45 px-3 text-sm text-slate-100 outline-none transition focus:border-amber-400/45"
                value={taskBranchName}
                onChange={(event) => onTaskBranchNameChange(event.target.value)}
                placeholder="未指定なら task/{id} を自動生成"
              />
            </label>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="m-0 text-xs font-medium text-slate-400">
                  依存タスク
                </p>
                <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-xs text-slate-300">
                  {selectedDependencyTaskIds.length} 件選択中
                </span>
              </div>

              <div
                className={`rounded-xl border border-slate-400/12 bg-slate-950/35 p-3 ${isDependencyDisabled ? 'opacity-60' : ''}`}
              >
                <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
                  {dependencyOptions.length === 0 ? (
                    <p className="m-0 rounded-xl border border-dashed border-slate-400/12 px-3 py-3 text-sm text-slate-500">
                      依存先に選べる既存タスクはまだありません。
                    </p>
                  ) : (
                    dependencyOptions.map((option) => (
                      <label
                        key={option.taskId}
                        className="flex items-start gap-3 rounded-xl border border-slate-400/10 bg-slate-950/35 px-3 py-3 text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                          checked={selectedDependencyTaskIds.includes(
                            option.taskId,
                          )}
                          disabled={isDependencyDisabled}
                          onChange={() => onToggleDependency(option.taskId)}
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
              </div>

              {dependencyDisabledMessage ? (
                <p className="m-0 text-xs text-slate-500">
                  {dependencyDisabledMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
