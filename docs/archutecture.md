# ディレクトリと責務と責務

## electron

- electronのコードを格納するディレクトリ
- [modeling](./modeling/)配下で定義されているようなドメインモデルの実装をする
- ツールの機能実装を責務とする

### electron/ipc

- ipcのハンドラーの定義をする
- electron/service配下のserviceをオーケストレーションレーションし、機能を提供することを責務とする

### electron/service

- ドメインロジックを格納するディレクトリ
- ドメインに閉じたロジックの実装を責務とする

### electron/repository

- 外部システムとの通信を責務とする
- mapperをオーケストレーションし、外部システムとモデリングのデータの型の差分吸収することも責務とする

## electron/mapper

- 型の変換ロジックを格納するディレクトリ
- 外部システムとドメインモデルの変換を責務とする

## electron/resource

- 外部システムから提供されるデータの型を格納するディレクトリ
- 外部システムの型定義を責務とする

### electron/entity

- ドメインモデルの型を格納するディレクトリ
- serviceやrepositoryなどelectron配下でレイヤーをまたぐような型の定義を責務とする

## share

- electronとreactのデータの受け渡し用の型を格納するディレクトリ
- electron配下とreact配下で共有で使うような型の定義を責務とする

## src

- reactのコードを格納するディレクトリ
- electron配下で実装された機能をuiとして提供するクライアントとしての責務を持つ

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
