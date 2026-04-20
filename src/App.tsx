/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_app_tsx'. Dependency is of type 'src_action' */
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
