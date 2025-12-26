import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { NotionClient } from "./utils/notion_client.ts";
import { UserMapper } from "./utils/user_mapper.ts";
import {
  collectFieldsFromInputs,
  convertToNotionProperties,
  UserMappingFunction,
} from "./utils/property_converter.ts";

export const UpdateNotionItemFunction = DefineFunction({
  callback_id: "update_notion_item",
  title: "Update Notion Database Item",
  description: "Update an existing item in a Notion database",
  source_file: "functions/update_notion_item.ts",
  input_parameters: {
    properties: {
      page_id: {
        type: Schema.types.string,
        description: "Notion Page ID to update",
      },
      field1_name: {
        type: Schema.types.string,
        description: "Property name for field 1",
      },
      field1_value: {
        type: Schema.types.string,
        description: "Property value for field 1",
      },
      field2_name: {
        type: Schema.types.string,
        description: "Property name for field 2",
      },
      field2_value: {
        type: Schema.types.string,
        description: "Property value for field 2",
      },
      field3_name: {
        type: Schema.types.string,
        description: "Property name for field 3",
      },
      field3_value: {
        type: Schema.types.string,
        description: "Property value for field 3",
      },
      field4_name: {
        type: Schema.types.string,
        description: "Property name for field 4",
      },
      field4_value: {
        type: Schema.types.string,
        description: "Property value for field 4",
      },
      field5_name: {
        type: Schema.types.string,
        description: "Property name for field 5",
      },
      field5_value: {
        type: Schema.types.string,
        description: "Property value for field 5",
      },
      field6_name: {
        type: Schema.types.string,
        description: "Property name for field 6",
      },
      field6_value: {
        type: Schema.types.string,
        description: "Property value for field 6",
      },
      field7_name: {
        type: Schema.types.string,
        description: "Property name for field 7",
      },
      field7_value: {
        type: Schema.types.string,
        description: "Property value for field 7",
      },
      field8_name: {
        type: Schema.types.string,
        description: "Property name for field 8",
      },
      field8_value: {
        type: Schema.types.string,
        description: "Property value for field 8",
      },
      field9_name: {
        type: Schema.types.string,
        description: "Property name for field 9",
      },
      field9_value: {
        type: Schema.types.string,
        description: "Property value for field 9",
      },
      field10_name: {
        type: Schema.types.string,
        description: "Property name for field 10",
      },
      field10_value: {
        type: Schema.types.string,
        description: "Property value for field 10",
      },
      user_field1_name: {
        type: Schema.types.string,
        description: "Property name for user field 1 (people property)",
      },
      user_field1_value: {
        type: Schema.slack.types.user_id,
        description: "User ID for user field 1",
      },
      user_field2_name: {
        type: Schema.types.string,
        description: "Property name for user field 2 (people property)",
      },
      user_field2_value: {
        type: Schema.slack.types.user_id,
        description: "User ID for user field 2",
      },
      user_field3_name: {
        type: Schema.types.string,
        description: "Property name for user field 3 (people property)",
      },
      user_field3_value: {
        type: Schema.slack.types.user_id,
        description: "User ID for user field 3",
      },
    },
    required: ["page_id"],
  },
  output_parameters: {
    properties: {
      page_id: {
        type: Schema.types.string,
        description: "Updated Notion page ID",
      },
      page_url: {
        type: Schema.types.string,
        description: "URL of the updated page",
      },
      success: {
        type: Schema.types.boolean,
        description: "Whether the operation was successful",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if operation failed",
      },
      user_mapping_warnings: {
        type: Schema.types.string,
        description: "Warnings about failed user mappings",
      },
    },
    required: ["success"],
  },
});

/**
 * Create UserMappingFunction adapter from UserMapper
 */
function createUserMappingAdapter(userMapper: UserMapper): UserMappingFunction {
  return {
    mapSingle: async (userId: string) => {
      const result = await userMapper.mapSlackUserToNotionUser(userId);
      return {
        notionUserId: result.notionUserId,
        error: result.error,
      };
    },
    mapMultiple: async (userIds: string) => {
      return await userMapper.mapMultipleUsers(userIds);
    },
  };
}

export default SlackFunction(
  UpdateNotionItemFunction,
  async ({ inputs, env, client }) => {
    try {
      const notionToken = env.NOTION_TOKEN || "";

      if (!notionToken) {
        return {
          outputs: {
            success: false,
            error: "NOTION_TOKEN environment variable is not set",
          },
        };
      }

      const pageId = inputs.page_id;
      const notionClient = new NotionClient(notionToken);

      // Get page info to find parent database
      const pageInfo = await notionClient.getPage(pageId);

      if (pageInfo.parent.type !== "database_id" || !pageInfo.parent.database_id) {
        return {
          outputs: {
            success: false,
            error: "The specified page is not part of a database",
          },
        };
      }

      const databaseId = pageInfo.parent.database_id;
      const userMapper = new UserMapper(client, notionClient);

      // Collect fields from inputs using shared function
      const collectedFields = collectFieldsFromInputs(inputs as Record<string, unknown>);

      // Get database schema
      const database = await notionClient.getDatabaseSchema(databaseId);
      const writableProperties = notionClient.getWritableProperties(database);

      // Convert to Notion properties using shared function
      const userMappingAdapter = createUserMappingAdapter(userMapper);
      const { notionProperties, warnings } = await convertToNotionProperties(
        collectedFields,
        writableProperties,
        userMappingAdapter,
      );

      // Check if there are any properties to update
      if (Object.keys(notionProperties).length === 0) {
        return {
          outputs: {
            success: false,
            error: "No valid properties to update",
          },
        };
      }

      // Update the Notion page
      const updatedPage = await notionClient.updatePage(pageId, notionProperties);

      return {
        outputs: {
          page_id: updatedPage.id,
          page_url: updatedPage.url,
          success: true,
          user_mapping_warnings: warnings.length > 0
            ? warnings.join("; ")
            : undefined,
        },
      };
    } catch (error) {
      console.error("Error updating Notion item:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error occurred";
      return {
        outputs: {
          success: false,
          error: `Failed to update Notion item: ${errorMessage}`,
        },
      };
    }
  },
);
