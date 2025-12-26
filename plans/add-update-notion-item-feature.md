# Notion DBアイテム更新機能 追加計画

## 概要

Slack WorkflowからNotionデータベースの既存アイテムを更新できる機能を追加する。

## 現状

- `CreateNotionItemFunction`: 新規アイテム作成のみ対応
- `NotionClient`: `createPage` メソッドのみ実装済み

## 実装タスク

### 1. NotionClient に updatePage メソッドを追加

**ファイル**: `functions/utils/notion_client.ts`

```typescript
async updatePage(
  pageId: string,
  properties: Record<string, NotionPageProperty>,
): Promise<NotionUpdatePageResponse> {
  return await this.makeRequest<NotionUpdatePageResponse>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}
```

### 2. 型定義の追加

**ファイル**: `types/notion.ts`

- `NotionUpdatePageResponse` 型を追加（`NotionCreatePageResponse` と同じ構造）

### 3. 新しい Slack Function の作成

**ファイル**: `functions/update_notion_item.ts`

入力パラメータ:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `page_id` | string | Yes | 更新対象のNotionページID |
| `field1_name` ~ `field10_name` | string | No | プロパティ名 |
| `field1_value` ~ `field10_value` | string | No | プロパティ値 |
| `user_field1_name` ~ `user_field3_name` | string | No | ユーザープロパティ名 |
| `user_field1_value` ~ `user_field3_value` | user_id | No | SlackユーザーID |

出力パラメータ:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `page_id` | string | 更新されたページID |
| `page_url` | string | ページURL |
| `success` | boolean | 成功フラグ |
| `error` | string | エラーメッセージ |
| `user_mapping_warnings` | string | ユーザーマッピング警告 |

### 4. manifest.ts の更新

**ファイル**: `manifest.ts`

- `UpdateNotionItemFunction` をインポート
- `functions` 配列に追加

### 5. README.md の更新

**ファイル**: `README.md`

- 新しい「Update Notion Database Item」機能の説明を追加
- 入力パラメータ（`page_id` 等）の説明
- 使用例の追加

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `types/notion.ts` | `NotionUpdatePageResponse` 型追加 |
| `functions/utils/notion_client.ts` | `updatePage` メソッド追加 |
| `functions/update_notion_item.ts` | 新規作成 |
| `manifest.ts` | 新しいfunctionを登録 |
| `README.md` | 更新機能のドキュメント追加 |

## Notion API リファレンス

- エンドポイント: `PATCH https://api.notion.com/v1/pages/{page_id}`
- ドキュメント: https://developers.notion.com/reference/patch-page

## 考慮事項

1. **page_id の取得方法**: ユーザーはワークフロー内で page_id を指定する必要がある
   - 前ステップで作成したページのIDを使う
   - 別途検索機能を実装する（将来の拡張）

2. **部分更新**: 指定されたフィールドのみ更新され、他のフィールドは維持される

3. **エラーハンドリング**: 存在しないpage_idや権限エラーの適切な処理

## 将来の拡張案

- ページ検索機能（`SearchNotionItemFunction`）
- ページ削除機能（`DeleteNotionItemFunction`）
- DBクエリ機能（条件に合うアイテムを取得）
