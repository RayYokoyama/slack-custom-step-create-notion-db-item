import { Manifest } from "deno-slack-sdk/mod.ts";
import { CreateNotionItemFunction } from "./functions/create_notion_item.ts";
import { UpdateNotionItemFunction } from "./functions/update_notion_item.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "notion-db-item-creator",
  description: "Create and update items in Notion databases using form data",
  icon: "assets/default_new_app_icon.png",
  functions: [CreateNotionItemFunction, UpdateNotionItemFunction],
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
