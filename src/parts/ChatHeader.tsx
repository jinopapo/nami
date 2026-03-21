type ChatHeaderProps = {
  workspaceLabel: string;
  bootError: string | null;
  onChooseDirectory: () => void;
};

export default function ChatHeader({
  workspaceLabel,
  bootError,
  onChooseDirectory,
}: ChatHeaderProps) {
  return (
    <section className="chatShellHeader">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-100">Nami</h1>
        </div>
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col items-stretch gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <div className="workspaceBadge">
            <span className={`pathLabel ${workspaceLabel === 'No directory selected' ? 'placeholder' : ''}`}>
              {workspaceLabel}
            </span>
          </div>
          <button className="secondaryButton" type="button" onClick={onChooseDirectory}>
            Workspace
          </button>
        </div>
      </div>
      {bootError ? <p className="errorText mt-3">{bootError}</p> : null}
    </section>
  );
}
