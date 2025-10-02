import { SlackAPI } from "deno-slack-api/types.ts";
import { NotionClient } from "./notion_client.ts";
import { NotionUser } from "../../types/notion.ts";

export interface UserMappingResult {
  notionUserId: string | null;
  slackUserId: string;
  error?: string;
}

export class UserMapper {
  constructor(
    private slackClient: SlackAPI,
    private notionClient: NotionClient,
  ) {}

  /**
   * Parse Slack user ID from various formats
   * Supports: U1234567, <@U1234567>, <@U1234567|username>
   */
  private parseSlackUserId(input: string): string {
    const trimmed = input.trim();

    // Handle mention format: <@U1234567> or <@U1234567|username>
    const mentionMatch = trimmed.match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>$/);
    if (mentionMatch) {
      return mentionMatch[1];
    }

    // Already a plain user ID
    return trimmed;
  }

  /**
   * Map a Slack user ID to a Notion user ID based on email
   */
  async mapSlackUserToNotionUser(
    slackUserId: string,
  ): Promise<UserMappingResult> {
    const parsedSlackUserId = this.parseSlackUserId(slackUserId);

    // Validate that the parsed ID looks like a Slack user ID
    if (!/^[A-Z0-9]{9,11}$/.test(parsedSlackUserId)) {
      console.error(
        `Invalid Slack user ID format. Original input: "${slackUserId}", Parsed: "${parsedSlackUserId}"`,
      );
      return {
        notionUserId: null,
        slackUserId: parsedSlackUserId,
        error:
          `Invalid Slack user ID format: "${slackUserId}". Expected format: U1234567 or <@U1234567>`,
      };
    }

    try {
      console.log(
        `Fetching Slack user info for: ${parsedSlackUserId} (original: ${slackUserId})`,
      );

      // Fetch Slack user info
      const slackUserResponse = await this.slackClient.users.info({
        user: parsedSlackUserId,
      });

      console.log(
        `Slack API response - ok: ${slackUserResponse.ok}, error: ${slackUserResponse.error || "none"}`,
      );

      if (!slackUserResponse.ok || !slackUserResponse.user) {
        const errorMsg = slackUserResponse.error || "Unknown error";
        return {
          notionUserId: null,
          slackUserId: parsedSlackUserId,
          error: `Slack API error: ${errorMsg}`,
        };
      }

      const slackEmail = slackUserResponse.user.profile?.email;

      if (!slackEmail) {
        console.warn(
          `Slack user ${parsedSlackUserId} has no email. Profile: ${JSON.stringify(slackUserResponse.user.profile)}`,
        );
        return {
          notionUserId: null,
          slackUserId: parsedSlackUserId,
          error: "Slack user has no email address (check users:read.email scope)",
        };
      }

      console.log(`Found Slack user email: ${slackEmail}`);

      // Fetch Notion users
      const notionUsers = await this.notionClient.listUsers();
      console.log(`Fetched ${notionUsers.length} Notion users`);

      // Find matching Notion user by email
      const matchingUsers = notionUsers.filter(
        (user: NotionUser) =>
          user.type === "person" &&
          user.person?.email?.toLowerCase() === slackEmail.toLowerCase(),
      );

      if (matchingUsers.length === 0) {
        console.warn(
          `No Notion user found with email: ${slackEmail}. Available emails: ${notionUsers.filter(u => u.type === "person").map(u => u.person?.email).join(", ")}`,
        );
        return {
          notionUserId: null,
          slackUserId: parsedSlackUserId,
          error: `No Notion user found with email: ${slackEmail}`,
        };
      }

      if (matchingUsers.length > 1) {
        console.warn(
          `Multiple Notion users found with email ${slackEmail}, using first match`,
        );
      }

      console.log(
        `Successfully mapped Slack user ${parsedSlackUserId} to Notion user ${matchingUsers[0].id}`,
      );

      return {
        notionUserId: matchingUsers[0].id,
        slackUserId: parsedSlackUserId,
      };
    } catch (error) {
      console.error(
        `Exception during user mapping for ${parsedSlackUserId}:`,
        error,
      );
      return {
        notionUserId: null,
        slackUserId: parsedSlackUserId,
        error: `Error mapping user: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Map multiple Slack user IDs to Notion user IDs
   * Supports comma-separated list
   */
  async mapMultipleUsers(input: string): Promise<UserMappingResult[]> {
    const slackUserIds = input.split(",").map((id) => id.trim()).filter((id) =>
      id.length > 0
    );

    const results = await Promise.all(
      slackUserIds.map((id) => this.mapSlackUserToNotionUser(id)),
    );

    return results;
  }
}
