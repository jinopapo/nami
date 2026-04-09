# readFile

## rawInput
```
{
    tool: 'readFile',
    path: 'nami',
    operationIsLocatedInWorkspace: true
}
```

## rawOutput
```
{
    tool: 'readFile',
    path: 'README.md',
    content: '/Users/ji-no/ghq/github.com/jinopapo/nami/README.md',
    operationIsLocatedInWorkspace: true
}
```

## 注意事項
rawInputにふくまれるpathはプロジェクトのルートパス
実際にファイルを読みに行くパスはrawOutputにふくまれるpath