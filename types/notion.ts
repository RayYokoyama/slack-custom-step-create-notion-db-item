export type NotionPropertyType =
  | "title"
  | "rich_text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "people"
  | "checkbox"
  | "url"
  | "email"
  | "phone_number"
  | "files"
  | "created_time"
  | "created_by"
  | "last_edited_time"
  | "last_edited_by";

export interface NotionPageProperty {
  type: NotionPropertyType;
  title?: Array<{ text: { content: string } }>;
  rich_text?: Array<{ text: { content: string } }>;
  number?: number;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string };
  people?: Array<{ id: string }>;
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  files?: Array<{ name: string; external?: { url: string } }>;
}

export interface NotionCreatePageRequest {
  parent: {
    database_id: string;
  };
  properties: Record<string, NotionPageProperty>;
}

export interface NotionCreatePageResponse {
  id: string;
  created_time: string;
  url: string;
}

export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: NotionPropertyType;
}

export interface NotionDatabase {
  id: string;
  title: Array<{ text: { content: string } }>;
  properties: Record<string, {
    id: string;
    name?: string;
    type: NotionPropertyType;
  }>;
}
