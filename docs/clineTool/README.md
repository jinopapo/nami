# Cline Tool

cline sdkのbuld in toolをつかったときに発生するjsonの形式をまとめたもの
`@cline/sdk@0.0.41` を対象に、**実際に tool を実行して得られた入出力**を `docs/clineTool/generated/built-in-tool-raw-io.json` に保存している。

## 調査スクリプト

- `docs/clineTool/collectBuiltInToolRawIo.mjs`

補足:

- 検証用の一時ファイルは repo 配下には残さない
- 実行中だけ OS のテンポラリディレクトリ配下に workspace を作り、`finally` で削除する

実行例:

```bash
node docs/clineTool/collectBuiltInToolRawIo.mjs
```

特定シナリオだけ実行する場合:

```bash
node docs/clineTool/collectBuiltInToolRawIo.mjs read_files-basic,editor-create
```

## 実測した built-in tools

`getCoreBuiltinToolCatalog()` のうち、今回実測できたのは以下。

| catalog id          | headless tool name  | 実測状況 |
| ------------------- | ------------------- | -------- |
| `read_files`        | `read_files`        | 実測済み |
| `search_codebase`   | `search_codebase`   | 実測済み |
| `run_commands`      | `run_commands`      | 実測済み |
| `editor`            | `editor`            | 実測済み |
| `fetch_web_content` | `fetch_web_content` | 実測済み |

未実測:

- `skills`
- `ask_question`
- `spawn_agent`
- `teams`

これらはユーザー対話や追加ランタイム依存が強いため、今回の単体調査スクリプトでは対象外にした。

## 実測結果サマリ

### 1. `read_files`

#### rawInput

```json
{
  "files": [
    {
      "path": "/absolute/path/to/info.txt",
      "start_line": 1,
      "end_line": 2
    }
  ]
}
```

#### rawOutput

```json
[
  {
    "query": "/absolute/path/to/info.txt:1-2",
    "result": "1 | FIRST_LINE\n2 | SECOND_LINE",
    "success": true
  }
]
```

#### 観測メモ

- 戻り値は **配列**
- `query` は `absolutePath:start-end` 形式
- `result` は行番号付きテキスト
- ファイル内容そのものではなく、表示向けに整形済みの文字列が返る

### 2. `search_codebase`

#### rawInput

```json
{
  "queries": ["SEARCH_TARGET_TOKEN"]
}
```

#### rawOutput

```json
[
  {
    "query": "SEARCH_TARGET_TOKEN",
    "result": "Found 3 results for pattern: SEARCH_TARGET_TOKEN\n...",
    "success": true
  }
]
```

#### 観測メモ

- 戻り値は **配列**
- `result` は構造化 JSON ではなく、**検索レポート全文の文字列**
- 今回の実行では fixture だけでなく `collectBuiltInToolRawIo.mjs` 自身もヒットした
- つまり検索対象は `cwd` 以下全体で、入力専用 fixture に閉じたいなら専用ワークスペースでの `cwd` 制御が重要

### 3. `run_commands`

#### rawInput

```json
{
  "commands": ["printf 'RUN_COMMANDS_OK\\n'"]
}
```

#### rawOutput

```json
[
  {
    "query": "printf 'RUN_COMMANDS_OK\\n'",
    "result": "RUN_COMMANDS_OK\n",
    "success": true
  }
]
```

#### 観測メモ

- 戻り値は **配列**
- `query` は実行コマンド文字列そのもの
- `result` は標準出力文字列
- 成功時も exit code は含まれない

### 4. `fetch_web_content`

#### rawInput

```json
{
  "requests": [
    {
      "url": "https://example.com",
      "prompt": "Return the page title only."
    }
  ]
}
```

#### rawOutput

```json
[
  {
    "query": "https://example.com",
    "result": "URL: https://example.com\nContent-Type: text/html\nSize: 528 bytes\n\n--- Content ---\nExample Domain ...\n\n--- Analysis Request ---\nPrompt: Return the page title only.",
    "success": true
  }
]
```

#### 観測メモ

- 戻り値は **配列**
- `result` は「抽出結果」ではなく、**取得した本文と analysis prompt をまとめた文字列**
- `prompt` を渡しても、その場で LLM が要約した結果になるわけではない
- UI では「fetch 結果の生本文」として扱う前提がよさそう

### 5. `editor` - create

#### rawInput

```json
{
  "path": "/absolute/path/to/editor-output.txt",
  "new_text": "EDITOR_FIRST_LINE\nEDITOR_SECOND_LINE\n"
}
```

#### rawOutput

```json
{
  "query": "edit:/absolute/path/to/editor-output.txt",
  "result": "File created successfully at: /absolute/path/to/editor-output.txt",
  "success": true
}
```

#### 観測メモ

- 戻り値は **配列ではなく単体オブジェクト**
- `old_text` 省略 + ファイル未存在で create 扱い
- `query` は `edit:` プレフィックス

### 6. `editor` - replace

#### rawInput

```json
{
  "path": "/absolute/path/to/replace-target.txt",
  "old_text": "BEFORE_VALUE",
  "new_text": "AFTER_VALUE"
}
```

#### rawOutput

````json
{
  "query": "edit:/absolute/path/to/replace-target.txt",
  "result": "Edited /absolute/path/to/replace-target.txt\n```diff\n-2: BEFORE_VALUE\n+2: AFTER_VALUE\n```",
  "success": true
}
````

#### 観測メモ

- 成功時 `result` に **diff 文字列** が入る
- 変更行番号も返る
- UI 表示ではこの `result` をそのまま表示すれば、かなり説明的

### 7. `editor` - insert

#### rawInput

```json
{
  "path": "/absolute/path/to/insert-target.txt",
  "new_text": "line2\n",
  "insert_line": 2
}
```

#### rawOutput

```json
{
  "query": "insert:/absolute/path/to/insert-target.txt",
  "result": "Inserted content at line 2 in /absolute/path/to/insert-target.txt.",
  "success": true
}
```

#### 観測メモ

- `insert_line` 指定時は `query` が `insert:` プレフィックスに変わる
- 今回の実測では、`new_text` に末尾改行があるため最終ファイルは `line2` のあとに空行が入った
- UI で「期待どおりの 1 行挿入」に見せたい場合、入力の改行有無を意識する必要がある

## 重要な観測ポイント

- tool によって **rawOutput の型が揃っていない**
  - `read_files` / `search_codebase` / `run_commands` / `fetch_web_content` は配列
  - `editor` は単体オブジェクト
- 返却値は全体的に **人間向け整形済み文字列** が多い
- `fetch_web_content` は「抽出結果」より「取得データのダンプ」に近い
- `search_codebase` は `cwd` 配下全体を対象にするため、fixture 以外のファイルがヒットしうる

## 生成物

- 実測 JSON: `docs/clineTool/generated/built-in-tool-raw-io.json`
- 再現スクリプト: `docs/clineTool/collectBuiltInToolRawIo.mjs`
- 一時 workspace: 実行時に `os.tmpdir()` 配下へ生成し、終了時に自動削除
