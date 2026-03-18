type ChatHeaderProps = {
  title: string;
  workspaceLabel: string;
  bootError: string | null;
  onChooseDirectory: () => void;
};

export default function ChatHeader({
  title,
  workspaceLabel,
  bootError,
  onChooseDirectory,
}: ChatHeaderProps) {
  return (
    <section className="panel p-[18px]">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1 basis-[320px]">
          <p className="eyebrow">Conversation</p>
          <h2 className="mt-1 text-[clamp(1.3rem,2vw,1.8rem)]">{title}</h2>
        </div>
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col items-stretch gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <div className="workspaceBadge">
            <span className="workspaceBadgeLabel">Workspace</span>
            <span className={`pathLabel ${workspaceLabel === 'No directory selected' ? 'placeholder' : ''}`}>
              {workspaceLabel}
            </span>
          </div>
          <button className="secondaryButton" type="button" onClick={onChooseDirectory}>
            Choose Directory
          </button>
        </div>
      </div>
      {bootError ? <p className="errorText mt-3">{bootError}</p> : null}
    </section>
  );
}
