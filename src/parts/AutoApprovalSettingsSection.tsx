type AutoApprovalSettingsSectionProps = {
  enabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onSave: () => void;
};

const description =
  '計画が完了したら、確認待ちで止めずに自動で実行へ移行します。';
const warning =
  'ON にすると、人間の「実行に移す」操作なしで act モードを開始します。計画内容を必ず確認したい場合は OFF にしてください。';

export default function AutoApprovalSettingsSection({
  enabled,
  isDirty,
  isSaving,
  onEnabledChange,
  onSave,
}: AutoApprovalSettingsSectionProps) {
  return (
    <div className="rounded-[20px] border border-slate-400/10 bg-slate-950/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="m-0 text-sm font-semibold text-slate-100">自動承認</h4>
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
      <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-950/10 p-3 text-xs leading-5 text-amber-100/80">
        {warning}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-60"
          disabled={!isDirty || isSaving}
          onClick={onSave}
        >
          {isSaving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}
