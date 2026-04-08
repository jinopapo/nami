# nami

`nami` は、Cline をチャットベースで扱うための Electron + React アプリケーションです。Electron 側で Cline 連携や永続化を担当し、React 側でタスクボードやチャット UI を提供します。

複数タスクを並列に見渡しながら、各タスクの会話履歴、承認リクエスト、ツール実行ログ、自動チェック結果を一つの UI で扱えることを目指しています。

## 主な機能

- タスクボードによる複数タスクの一覧・状態管理
- タスク詳細ドロワー上でのチャット実行
- 会話タイムラインへのイベント集約
  - ユーザーメッセージ
  - AI メッセージ
  - ツール呼び出し
  - 承認要求
  - エラー
  - 自動チェック結果
- ワークスペース単位の自動チェック設定
- Electron 側での Cline セッション制御とデータ永続化

## 技術スタック

- Electron
- React 19
- TypeScript
- Vite
- Zustand
- Vitest
- ESLint / Prettier

## アーキテクチャ概要

このプロジェクトは、ドメインモデルを中心に責務を分離する構成を採用しています。

- `electron/`
  - Cline 操作、IPC ハンドラー、永続化、ビジネスロジックを担当
- `src/`
  - React ベースの UI を担当
- `core/`
  - Electron と React の間で受け渡す共通の型を配置

### ディレクトリ構成

```text
.
├── core/        # Electron / React 間の共通型
├── docs/        # アーキテクチャ・モデリングなどの設計資料
├── electron/    # メインプロセス、IPC、サービス、リポジトリ
└── src/         # レンダラープロセス側 UI
```

より詳細な構成は以下を参照してください。

- `docs/archutecture.md`
- `docs/modeling.md`

## モデリング

このアプリでは、会話を次のように捉えています。

- イベント: ユーザーまたは AI の行動
- セッション: イベントの集合体
- セッションの状態: 最新のイベントによって決まる

イベントには、主に以下が含まれます。

- ユーザーの発話
- AI の発話
- AI の行動

## セットアップ

依存関係をインストールします。

```bash
npm install
```

## 開発用コマンド

```bash
# 型チェック
npm run typecheck

# Lint
npm run lint

# テスト実行
npm run test

# 開発用起動スクリプト
npm run dev
```

`package.json` には他にも未使用コード検出や format 系のスクリプトが定義されています。

## 開発ルール・注意事項

このリポジトリでは、実装時に以下のルールを前提とします。

- `npm run build` は実行しない
- 実際にアプリを起動しての動作確認はしない
- 動作保証はテストコードで行う

また、設計や実装時には次のドキュメントを参照してください。

- `AGENTS.md`
- `eslint.architecture.config.js`
- `docs/archutecture.md`
- `docs/modeling.md`

## スクリプト一覧

主要な npm scripts は以下です。

- `npm run dev`: renderer / electron の開発環境を起動
- `npm run typecheck`: TypeScript の型検査
- `npm run lint`: ESLint 実行
- `npm run test`: Vitest 実行
- `npm run detect-unused-code`: 未使用コードの検出
- `npm run format`: Prettier による整形

## 今後 README で拡充しやすい項目

今後必要に応じて、以下を追記しやすい構成にしています。

- UI スクリーンショット
- 代表的なユースケース
- IPC イベント一覧
- 永続化データの扱い
- 自動チェック機能の詳細
