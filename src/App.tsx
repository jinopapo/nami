import ChatPanelContainer from './component/ChatPanelContainer';
import SidebarContainer from './component/SidebarContainer';

export default function App() {
  return (
    <main className="shell">
      <SidebarContainer />
      <ChatPanelContainer />
    </main>
  );
}
