import { useAppInitAction } from './action/useAppInitAction';
import ChatPanelContainer from './component/ChatPanelContainer';

export default function App() {
  useAppInitAction();

  return (
    <main className="shell">
      <ChatPanelContainer />
    </main>
  );
}
