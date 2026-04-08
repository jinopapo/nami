# ディレクトリと責務と責務

## electron

- electronのコードを格納するディレクトリ
- [modeling](./modeling/)配下で定義されているようなドメインモデルの実装をする

### electron/ipc

- ipcのハンドラーの定義をする
- electron/service配下のserviceをオーケストレーションレーションする

### electron/service

- ビジネスロジックを格納するディレクトリ

### electron/repository

- 外部システムとの通信を責務とする
- 外部システムとモデリングのデータの型の差分などはここで吸収する

### electron/entity

- ドメインモデルやエンティティの型を格納するディレクトリ

## core

- electronとreactのデータの受け渡し用の型を格納するディレクトリ

## src

- reactのコードを格納するディレクトリ

### src/components

- partsとactionを組み合わせてコンポーネントを作成するディレクトリ

### src/parts

- UIの部品を格納するディレクトリ

### src/action

- serviceを組み合わせてuiの振る舞いを定義するディレクトリ

### src/service

- uiの振る舞いの実装を格納するディレクトリ
- データ変換や状態の更新ロジックなどを実装するディレクトリ

### src/repository

- electronのipcハンドラーとの通信を格納するディレクトリ

### src/model

- uiのドメインモデルやエンティティの型を格納するディレクトリ

### src/store

- コンポーネントをまたぐ状態管理を格納するディレクトリ

## lint

- eslintやprettierの設定ファイルを格納するディレクトリ
