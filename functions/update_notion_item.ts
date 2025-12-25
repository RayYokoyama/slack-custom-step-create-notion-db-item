import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { NotionClient } from "./utils/notion_client.ts";
import { UserMapper } from "./utils/user_mapper.ts";
import { NotionPageProperty } from "../types/notion.ts";

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

export default SlackFunction(
  UpdateNotionItemFunction,
  async ({ inputs, env, client }) => {
    try {
      // Get token from environment variable
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

      // Collect field pairs from inputs
      const propertiesData: Record<string, unknown> = {};
      const userFieldsData: Record<string, string> = {};

      // Collect user fields (these use user_id type)
      for (let i = 1; i <= 3; i++) {
        const fieldName = inputs[`user_field${i}_name`] as string;
        const fieldValue = inputs[`user_field${i}_value`] as string;

        if (fieldName && fieldValue) {
          userFieldsData[fieldName] = fieldValue;
        }
      }

      // Collect regular fields
      for (let i = 1; i <= 10; i++) {
        const fieldName = inputs[`field${i}_name`] as string;
        const fieldValue = inputs[`field${i}_value`] as string;

        if (fieldName && fieldValue) {
          propertiesData[fieldName] = fieldValue;
        }
      }

      const userMapper = new UserMapper(client, notionClient);

      // Track user mapping warnings
      const userMappingWarnings: string[] = [];

      // Get database schema to validate and convert properties
      const database = await notionClient.getDatabaseSchema(databaseId);
      const writableProperties = notionClient.getWritableProperties(database);

      // Convert input data to Notion properties format
      const notionProperties: Record<string, NotionPageProperty> = {};

      // Process user fields first (dedicated people properties)
      for (const [fieldName, userId] of Object.entries(userFieldsData)) {
        if (!userId) continue;

        const propertyDef = writableProperties.find((p) =>
          p.name === fieldName
        );
        if (!propertyDef) {
          console.warn(`Unknown property: ${fieldName}`);
          continue;
        }

        if (propertyDef.type !== "people") {
          console.warn(
            `Property ${fieldName} is not a people type (got ${propertyDef.type}). Skipping user field.`,
          );
          continue;
        }

        // Map the Slack user ID to Notion user ID
        const mappingResult = await userMapper.mapSlackUserToNotionUser(userId);

        if (mappingResult.notionUserId) {
          notionProperties[fieldName] = {
            type: "people",
            people: [{ id: mappingResult.notionUserId }],
          };
          console.log(
            `Mapped user field ${fieldName}: ${userId} -> ${mappingResult.notionUserId}`,
          );
        } else {
          const warning =
            `Failed to map user field ${fieldName} (${userId}): ${mappingResult.error || "Unknown error"}`;
          console.warn(warning);
          userMappingWarnings.push(warning);
        }
      }

      // Process regular fields
      for (const [fieldName, fieldValue] of Object.entries(propertiesData)) {
        if (
          fieldValue === null || fieldValue === undefined || fieldValue === ""
        ) {
          continue;
        }

        const propertyDef = writableProperties.find((p) =>
          p.name === fieldName
        );
        if (!propertyDef) {
          console.warn(`Unknown property: ${fieldName}`);
          continue;
        }

        // Convert based on property type
        switch (propertyDef.type) {
          case "title":
            notionProperties[fieldName] = {
              type: "title",
              title: [{ text: { content: String(fieldValue) } }],
            };
            break;
          case "rich_text":
            notionProperties[fieldName] = {
              type: "rich_text",
              rich_text: [{ text: { content: String(fieldValue) } }],
            };
            break;
          case "number": {
            const numValue = typeof fieldValue === "number"
              ? fieldValue
              : parseFloat(String(fieldValue));
            if (!isNaN(numValue)) {
              notionProperties[fieldName] = {
                type: "number",
                number: numValue,
              };
            }
            break;
          }
          case "select":
            notionProperties[fieldName] = {
              type: "select",
              select: { name: String(fieldValue) },
            };
            break;
          case "multi_select": {
            const multiSelectValues = Array.isArray(fieldValue)
              ? fieldValue
              : [fieldValue];
            notionProperties[fieldName] = {
              type: "multi_select",
              multi_select: multiSelectValues.map((v) => ({ name: String(v) })),
            };
            break;
          }
          case "date": {
            // Convert various date formats to ISO 8601 (YYYY-MM-DD)
            let isoDate = String(fieldValue);

            // Convert YYYY/MM/DD to YYYY-MM-DD
            if (isoDate.includes("/")) {
              const parts = isoDate.split("/");
              if (parts.length === 3) {
                isoDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
              }
            }

            // Validate ISO date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
              console.warn(`Invalid date format for ${fieldName}: ${fieldValue}. Expected YYYY-MM-DD format.`);
              break;
            }

            notionProperties[fieldName] = {
              type: "date",
              date: { start: isoDate },
            };
            break;
          }
          case "checkbox":
            notionProperties[fieldName] = {
              type: "checkbox",
              checkbox: Boolean(fieldValue),
            };
            break;
          case "url":
            notionProperties[fieldName] = {
              type: "url",
              url: String(fieldValue),
            };
            break;
          case "email":
            notionProperties[fieldName] = {
              type: "email",
              email: String(fieldValue),
            };
            break;
          case "phone_number":
            notionProperties[fieldName] = {
              type: "phone_number",
              phone_number: String(fieldValue),
            };
            break;
          case "people": {
            // Map Slack user IDs to Notion user IDs
            const mappingResults = await userMapper.mapMultipleUsers(
              String(fieldValue),
            );

            // Track failed mappings
            const failedMappings = mappingResults.filter((result) =>
              result.notionUserId === null
            );
            if (failedMappings.length > 0) {
              failedMappings.forEach((failed) => {
                const warning =
                  `Failed to map Slack user ${failed.slackUserId}: ${failed.error || "Unknown error"}`;
                console.warn(warning);
                userMappingWarnings.push(warning);
              });
            }

            // Get successfully mapped user IDs
            const validUserIds = mappingResults
              .filter((result) => result.notionUserId !== null)
              .map((result) => result.notionUserId as string);

            if (validUserIds.length > 0) {
              notionProperties[fieldName] = {
                type: "people",
                people: validUserIds.map((id) => ({ id })),
              };
            } else if (mappingResults.length > 0) {
              // All mappings failed
              console.warn(
                `No valid Notion users found for people property: ${fieldName}`,
              );
            }
            break;
          }
          default:
            console.warn(`Unsupported property type: ${propertyDef.type}`);
        }
      }

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
          user_mapping_warnings: userMappingWarnings.length > 0
            ? userMappingWarnings.join("; ")
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
