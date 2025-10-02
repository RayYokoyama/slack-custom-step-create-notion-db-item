import {
  NotionCreatePageRequest,
  NotionCreatePageResponse,
  NotionDatabase,
  NotionDatabaseProperty,
  NotionUsersListResponse,
  NotionUser,
} from "../../types/notion.ts";

export class NotionClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";
  private usersCacheExpiry: number | null = null;
  private usersCache: NotionUser[] | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

  async listUsers(): Promise<NotionUser[]> {
    // Check if cache is valid
    const now = Date.now();
    if (
      this.usersCache !== null &&
      this.usersCacheExpiry !== null &&
      now < this.usersCacheExpiry
    ) {
      return this.usersCache;
    }

    // Fetch all users (handle pagination)
    const allUsers: NotionUser[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const url = startCursor ? `/users?start_cursor=${startCursor}` : "/users";
      const response = await this.makeRequest<NotionUsersListResponse>(url);

      allUsers.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    // Update cache
    this.usersCache = allUsers;
    this.usersCacheExpiry = now + this.CACHE_DURATION_MS;

    return allUsers;
  }
}
