declare global {
  interface Window {
    nami?: {
      platform: string;
    };
  }
}

export default function App() {
  return (
    <main className="app">
      <section className="card">
        <p className="eyebrow">React + TypeScript + Electron</p>
        <h1>Nami</h1>
        <p className="description">
          開発環境のひな形を作成しました。React をレンダラー、Electron をデスクトップシェルとして利用しています。
        </p>
        <ul>
          <li>UI: React 19</li>
          <li>言語: TypeScript</li>
          <li>バンドラ: Vite</li>
          <li>実行環境: Electron</li>
        </ul>
        <p className="platform">
          Platform: <strong>{window.nami?.platform ?? 'unknown'}</strong>
        </p>
      </section>
    </main>
  );
}