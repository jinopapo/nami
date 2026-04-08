# editedExistingFile

## rawInput

```
{
  "tool": "editedExistingFile",
  "path": "README.md",
  "content": "%%bash\napply_patch <<\"EOF\"\n*** Begin Patch\n*** Update File: README.md\n@@\n - UI スクリーンショット\n - 代表的なユースケース\n - IPC イベント一覧\n - 永続化データの扱い\n - 自動チェック機能の詳細\n+\n+test\n*** End Patch\nEOF",
  "operationIsLocatedInWorkspace": true
}
```

## rawOutput

```
{
  "tool": "editedExistingFile",
  "path": "README.md",
  "content": "%%bash\napply_patch <<\"EOF\"\n*** Begin Patch\n*** Update File: README.md\n@@\n - UI スクリーンショット\n - 代表的なユースケース\n - IPC イベント一覧\n - 永続化データの扱い\n - 自動チェック機能の詳細\n+\n+test\n*** End Patch\nEOF",
  "operationIsLocatedInWorkspace": true,
  "startLineNumbers": [
    132
  ]
}
```
