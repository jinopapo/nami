import { useSidebarAction } from '../action/useSidebarAction';
import Sidebar from '../parts/Sidebar';

export default function SidebarContainer() {
  const {
    sessions,
    selectedSessionId,
    title,
    cwd,
    workspaceLabel,
    bootError,
    setTitle,
    selectSession,
    handleCreateSession,
    handleChooseDirectory,
  } = useSidebarAction();

  return (
    <Sidebar
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      title={title}
      cwd={cwd}
      workspaceLabel={workspaceLabel}
      bootError={bootError}
      onTitleChange={setTitle}
      onSelectSession={selectSession}
      onCreateSession={() => void handleCreateSession()}
      onChooseDirectory={() => void handleChooseDirectory()}
    />
  );
}