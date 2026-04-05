import type { TaskLifecycleAction } from '../service/taskLifecycleService';

type TaskDecisionPromptProps = {
  actions: TaskLifecycleAction[];
  onAction: (action: TaskLifecycleAction) => void;
};

export default function TaskDecisionPrompt({ actions, onAction }: TaskDecisionPromptProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="mx-3 mb-3 mt-0 rounded-[24px] border border-amber-400/26 bg-[linear-gradient(180deg,rgba(71,37,9,0.36),rgba(40,22,10,0.28))] px-4 py-4 text-slate-200 shadow-[0_18px_50px_rgba(0,0,0,0.24)] md:mx-5">
      <div className="flex flex-col gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">確認待ち</p>
          <h4 className="m-0 mt-1 text-base font-semibold text-slate-100">計画を確認して次の操作を選んでください</h4>
          <p className="m-0 mt-2 text-sm leading-6 text-slate-300">
            実行に進める場合は下のボタンを選択してください。追加の修正依頼がある場合は、そのまま下の入力欄からメッセージを送れます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={action.tone === 'primary'
                ? 'rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3.5 py-2.5 text-sm font-bold text-slate-900 transition hover:-translate-y-px'
                : 'rounded-full border border-slate-300/16 bg-slate-400/10 px-3.5 py-2.5 text-sm text-slate-100 transition hover:-translate-y-px'}
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}