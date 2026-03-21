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
  const isPlaceholder = workspaceLabel === 'No directory selected';

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-slate-400/14 bg-[rgba(9,15,25,0.78)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-[16px]">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[1.05rem] font-semibold tracking-[-0.02em] text-slate-100">Nami</h1>
        </div>
        <div className="flex min-w-0 flex-1 basis-[560px] flex-col items-stretch gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-2.5 rounded-full border border-slate-400/16 bg-slate-950/60 px-3.5 py-2.5 md:min-w-[min(100%,420px)]">
            <span
              className={`min-w-0 flex-1 break-words text-left text-sm ${isPlaceholder ? 'text-[rgba(159,178,203,0.72)]' : 'text-slate-400'}`}
              style={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}
            >
              {workspaceLabel}
            </span>
          </div>
          <button
            className="rounded-full bg-slate-400/14 px-3.5 py-2.5 text-inherit transition duration-150 ease-out hover:-translate-y-px"
            type="button"
            onClick={onChooseDirectory}
          >
            Workspace
          </button>
        </div>
      </div>
      {bootError ? <p className="mt-3 m-0 text-rose-300">{bootError}</p> : null}
    </section>
  );
}
