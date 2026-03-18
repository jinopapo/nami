import { useAppInitAction } from './action/useAppInitAction';
import ChatPanelContainer from './component/ChatPanelContainer';

export default function App() {
  useAppInitAction();

  return (
    <main className="min-h-screen p-[18px]">
      <ChatPanelContainer />
    </main>
  );
}
