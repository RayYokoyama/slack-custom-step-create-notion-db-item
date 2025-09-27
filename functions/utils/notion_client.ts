import {
  NotionCreatePageRequest,
  NotionCreatePageResponse,
  NotionDatabase,
  NotionDatabaseProperty,
} from "../../types/notion.ts";

export class NotionClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";

  constructor(token: string) {
    this.token = token;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Notion API error (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }

  async createPage(
    request: NotionCreatePageRequest,
  ): Promise<NotionCreatePageResponse> {
    return await this.makeRequest<NotionCreatePageResponse>("/pages", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getDatabaseSchema(databaseId: string): Promise<NotionDatabase> {
    return await this.makeRequest<NotionDatabase>(`/databases/${databaseId}`);
  }

  getWritableProperties(database: NotionDatabase): NotionDatabaseProperty[] {
    const writableProperties: NotionDatabaseProperty[] = [];

    for (const [key, property] of Object.entries(database.properties)) {
      // Skip read-only properties
      if (
        property.type === "created_time" ||
        property.type === "created_by" ||
        property.type === "last_edited_time" ||
        property.type === "last_edited_by"
      ) {
        continue;
      }

      writableProperties.push({
        id: property.id,
        name: property.name || key,
        type: property.type,
      });
    }

    return writableProperties;
  }
}
