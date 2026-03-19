# Implementation Plan

[Overview]
チャット送信時に既存の Cline セッションを再利用せず、常に新規セッションを作成してからプロンプトを送る動作へ統一する。

現在の実装では、UI が選択中の `sessionId` をそのまま `chat:sendMessage` に渡し、Electron 側の `ClineSessionService.sendMessage()` は `ensureRuntimeSession()` を通じて既存セッションの復元または再利用を試みる構造になっている。これにより、保存済みセッションが `archived` 扱いになっている場合に `unstable_resumeSession()` の可否や復旧結果に依存し、`This session is archived and cannot accept new prompts.` エラーが発生する経路が残っている。

今回の実装では、「会話を継続するために同じ Cline セッションを再開する」という前提を捨て、送信のたびに新しい Cline セッションを生成する方針へ切り替える。UI 上の会話履歴・セッション一覧という概念は維持しつつ、送信対象の実行セッションは毎回新規に払い出し、必要であれば過去セッションのメタデータやイベントを新しいセッションへ引き継ぐ。これにより、アーカイブ済みセッションの再開失敗に依存しない送信フローにできる。

既存コードとの整合性を保つため、変更の中心は Electron 側のサービス層と IPC 契約に置く。フロントエンドは「送信時に新しいセッションが作られうる」ことを前提に、返却された新しい `ChatSessionSummary` をストアへ反映し、選択中セッションを切り替える実装へ調整する。加えて、セッション作成・送信・イベント永続化の責務を明確化し、テストで「送信のたびに新規セッション ID が使われ、旧セッションの archived 状態に影響されない」ことを保証する。

[Types]
送信 API が新しいセッション情報を返せるように、IPC 入出力型を拡張する。

`core/chat.ts`

- `SendMessageInput`
  - 現状: `{ sessionId: string; text: string; }`
  - 変更後: 既存形を維持しつつ、`sessionId` は「送信元として選択されている UI セッション ID」を意味する値として扱う。
  - バリデーション:
    - `sessionId` は空文字不可
    - `text` は trim 後に空文字不可（UI 側既存制御を継続）

- `SendMessageResult` を新規追加
  - 目的: 送信時に生成された新規セッションを UI へ返却する
  - 想定定義:
    - `session: ChatSessionSummary`
  - ルール:
    - 返却される `session.sessionId` は常に実際にプロンプト送信に使った新規セッション ID
    - `session.cwd` は送信元セッション、または明示された作業ディレクトリを引き継ぐ

`electron/entity/chat.ts`

- `StoredSessionRecord`
  - フィールド追加候補:
    - `parentSessionId?: string`
      - 型: `string | undefined`
      - 用途: どの UI セッションから派生した新規セッションかを追跡する
    - `archivedAt?: string`
      - 型: `string | undefined`
      - 用途: セッションのライフサイクルを明確化する
  - 関係:
    - 新規送信で作成されるセッションは、元セッションを `parentSessionId` で参照できるようにする

- `RuntimeSessionRecord`
  - `parentSessionId?: string` を追加候補とする
  - `diffSnapshot` は従来通り保持する

型変更の基本方針は、「送信後に UI が選択すべきセッション ID を明示的に返す」ことと、「旧セッションと新セッションの関係を後から辿れる」ことにある。既存の `ChatSessionSummary` は UI 表示に必要な最小構成なので維持し、必要なら `parentSessionId` を summary に含めるかは実装時に判断する。少なくとも内部保存型では派生関係を持てるようにする。

[Files]
主に Electron サービス層、IPC 契約、UI 送信フロー、テスト、および計画書ファイルを更新する。

新規作成ファイル:

- `implementation_plan.md`
  - 本計画書。実装手順と変更対象の参照元。

変更対象ファイル:

- `core/chat.ts`
  - `SendMessageResult` の追加
  - 必要なら `ChatSessionSummary` へ派生元情報を追加
  - IPC 契約の送信メソッド戻り値を新仕様に合わせる

- `electron/entity/chat.ts`
  - `StoredSessionRecord` / `RuntimeSessionRecord` に派生関係やアーカイブ時刻などの補助メタデータを追加

- `electron/service/ClineSessionService.ts`
  - `sendMessage()` を「既存セッション再利用」から「新規セッション作成 + 送信」に作り替える
  - 旧 `ensureRuntimeSession()` 依存を削減または送信経路から切り離す
  - 必要なら `cloneSessionContext()` / `createFollowupSession()` のような内部ヘルパーを追加
  - 旧セッションを archived として扱うタイミングを整理

- `electron/ipc/chat.ts`
  - `chat:sendMessage` ハンドラーが `Promise<void>` ではなく、新規セッション情報を返すよう変更
  - ユーザーメッセージイベントの紐付け先を新セッション ID ベースへ修正

- `src/repository/chatRepository.ts`
  - `sendMessage()` の戻り値型を `Promise<SendMessageResult>` に更新

- `src/service/chatService.ts`
  - repository の新シグネチャへ追従

- `src/action/useChatPanelAction.ts`
  - 送信成功時に返却された新規セッションを `upsertSession()` し、`selectSession()` で切り替える
  - 旧選択セッションをそのまま前提にしないよう修正

- `src/action/useSidebarAction.ts`
  - セッション選択時の `resumeSession()` の扱いを見直す
  - 過去セッションの閲覧専用化、または「選択は履歴閲覧、送信時は新規派生」を前提としたエラーハンドリングへ調整

- `src/store/chatStore.ts`
  - 新規セッションが先頭に追加された際の選択状態・イベント保持を確認
  - 必要なら派生セッション切替時のストア更新補助関数を追加

- `electron/service/ClineSessionService.test.ts`
  - 既存の resume 前提テストを新仕様へ更新
  - 「archived セッションからの送信でも新規セッションで成功する」ことを追加検証

- `src/store/chatStore.test.ts`
  - 新規セッションへの選択切替や既存イベント保持の振る舞いを必要に応じて追加検証

- `src/global.d.ts`
  - preload 経由の `window.nami.chat.sendMessage` 戻り値型を更新

削除または移動候補:

- 明示的な削除予定ファイルはない
- ただし `ClineSessionService` 内の resume 専用分岐の一部は不要化する可能性がある

設定変更:

- 依存追加が不要であれば `package.json` / `tsconfig` の変更は不要

[Functions]
送信経路を新規セッション生成型に置き換え、戻り値契約を明示する。

新規追加候補関数:

- `createFollowupSession(sourceSessionId: string, text: string): Promise<RuntimeSessionRecord>`
  - ファイル: `electron/service/ClineSessionService.ts`
  - 目的: 既存 UI セッションの文脈をもとに、新しい実行用セッションを作成する

- `buildDerivedSessionRecord(source: StoredSessionRecord, newSessionId: string, mode: 'plan' | 'act'): StoredSessionRecord`
  - ファイル: `electron/service/ClineSessionService.ts`
  - 目的: 元セッション情報を引き継いだ保存レコードを生成する

- `archiveSession(sessionId: string): Promise<void>` または同等の内部ヘルパー
  - ファイル: `electron/service/ClineSessionService.ts`
  - 目的: 旧セッションを再利用対象ではなく履歴として明示する

変更対象関数:

- `ClineSessionService.sendMessage(input)`
  - ファイル: `electron/service/ClineSessionService.ts`
  - 現状: `ensureRuntimeSession(input.sessionId)` で既存セッションを取得して同一 `sessionId` に prompt を送る
  - 変更内容:
    - 元セッションの存在確認のみ行う
    - 新規 `agent.newSession()` を発行する
    - 新規セッションへ listener を接続する
    - ユーザープロンプトを新規セッションへ送る
    - 新規 `StoredSessionRecord` を保存して返却する
    - 必要に応じて元セッションを archived 化する

- `ClineSessionService.createSession(input)`
  - ファイル: `electron/service/ClineSessionService.ts`
  - 変更内容:
    - 共通の runtime/session record 構築処理を再利用できるよう内部抽象化する

- `registerChatIpc(...).sendMessage handler`
  - ファイル: `electron/ipc/chat.ts`
  - 変更内容:
    - 先に元 `sessionId` へイベントを積むのではなく、実際に送信された新セッション ID ベースで user message event を発火・永続化する
    - `SendMessageResult` を renderer へ返す

- `chatRepository.sendMessage(input)`
  - ファイル: `src/repository/chatRepository.ts`
  - 変更内容: 戻り値型変更のみ

- `useChatPanelAction.handleSend()`
  - ファイル: `src/action/useChatPanelAction.ts`
  - 変更内容:
    - `await chatService.sendMessage(...)` の返り値から `session` を受け取る
    - `upsertSession()` と `selectSession()` を行う
    - draft クリア順序を送信成功後に維持する

- `useSidebarAction.selectSession(sessionId)`
  - ファイル: `src/action/useSidebarAction.ts`
  - 変更内容:
    - 過去セッション選択時に強制 resume が必要かを見直す
    - 新ポリシーに合わせて閲覧中心の処理へ寄せる、または resume 失敗を UI 送信不能に直結させない

削除・縮小候補関数:

- `ensureRuntimeSession(sessionId)` の「archived セッション復旧」責務
  - ファイル: `electron/service/ClineSessionService.ts`
  - 理由: 送信時に既存セッションを再利用しないなら、少なくとも送信経路では不要
  - 移行方針: `resumeSession()` 専用のロジックへ限定するか、閲覧用に簡素化する

[Classes]
既存クラスの責務を「セッション復元中心」から「新規派生セッション生成中心」へ再編する。

変更対象クラス:

- `ClineSessionService`
  - ファイル: `electron/service/ClineSessionService.ts`
  - 変更点:
    - 送信 API の返り値を新セッション情報付きへ変更
    - runtime 管理マップのキー追加タイミングを新セッション生成中心へ変更
    - archived 判定を「送信失敗理由」ではなく「履歴状態」として扱う
    - listener 重複登録防止を新セッション生成でも維持

- `SessionStore`
  - ファイル: `electron/repository/sessionStore.ts`
  - 直接的な大規模変更は不要見込みだが、追加メタデータを保存できるよう型追従が必要

新規クラス:

- 新規クラス追加予定はない

削除クラス:

- 削除予定なし

[Dependencies]
追加パッケージは不要で、既存の TypeScript・Electron・Vitest 構成内で完結させる。

新規依存:

- なし

バージョン変更:

- なし

統合要件:

- `cline` の既存 `newSession()` / `prompt()` API を利用する
- `unstable_resumeSession()` 依存は送信の主要経路から外す

[Testing]
サービス層のユニットテストを中心に、送信時の新規セッション生成と UI 側のセッション切替を検証する。

追加・更新すべきテスト:

- `electron/service/ClineSessionService.test.ts`
  - `sendMessage()` が既存 `sessionId` ではなく新規 `sessionId` に対して `prompt()` を呼ぶこと
  - archived な保存セッションからの送信でも、新規 `newSession()` 経由で成功すること
  - `unstable_resumeSession()` 非対応時でも、送信自体は失敗しないこと（新方針に合わせる場合）
  - 新規セッション保存後に `live` / `archived` / `parentSessionId` が期待通りであること

- `src/store/chatStore.test.ts`
  - 新規派生セッションを `upsertSession()` した際に先頭へ並び、選択が移ること
  - 元セッションのイベント履歴が失われないこと

- 必要に応じて `electron/ipc/chat.ts` 周辺の統合寄りテスト
  - `chat:sendMessage` が `SendMessageResult` を返し、イベントが新セッション ID へ流れること

検証戦略:

- まずユニットテストで API 契約を固定し、その後 UI ハンドラーの挙動を追従させる
- archived セッション再現ケースを回帰テスト化して、元エラーの再発を防ぐ

[Implementation Order]
IPC 契約を先に固め、次に Electron サービス、最後に UI とテストを追従させる順序で進める。

1. `core/chat.ts` と `src/global.d.ts` の送信戻り値型を定義し、`SendMessageResult` 契約を追加する。
2. `electron/entity/chat.ts` の保存型・実行型に、必要な派生メタデータを追加する。
3. `electron/service/ClineSessionService.ts` を更新し、送信時に常に `agent.newSession()` を生成するフローへ置き換える。
4. `electron/ipc/chat.ts` を更新し、新セッション ID ベースで user message event を発火・永続化し、`SendMessageResult` を返す。
5. `src/repository/chatRepository.ts` と `src/service/chatService.ts` の戻り値型を更新する。
6. `src/action/useChatPanelAction.ts` を更新し、送信成功後に返却セッションを store へ反映して選択を切り替える。
7. `src/action/useSidebarAction.ts` の resume 挙動を新ポリシーに合わせて調整し、必要なら閲覧中心へ簡素化する。
8. `electron/service/ClineSessionService.test.ts` と関連テストを更新し、archived セッション起点の回帰ケースを追加する。
9. `src/store/chatStore.test.ts` など UI 側テストを更新し、新セッション追加時の状態遷移を確認する。
10. 全テストを実行し、送信時に archived エラーが発生しないこと、およびセッション一覧・イベント表示が破綻しないことを確認する。