import { Manifest } from "deno-slack-sdk/mod.ts";
import { CreateNotionItemFunction } from "./functions/create_notion_item.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "notion-db-item-creator",
  description: "Create items in a predefined Notion database using form data",
  icon: "assets/default_new_app_icon.png",
  functions: [CreateNotionItemFunction],
  workflows: [],
  outgoingDomains: ["api.notion.com"],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "workflow.steps:execute",
    "users:read",
    "users:read.email",
  ],
  env: {
    NOTION_TOKEN: {
      type: "string",
      description: "Notion Integration Token (secret_xxxxx...)",
    },
  },
});
