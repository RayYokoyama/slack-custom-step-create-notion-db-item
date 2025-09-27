import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { NotionClient } from "./utils/notion_client.ts";
import {
  NotionCreatePageRequest,
  NotionPageProperty,
} from "../types/notion.ts";

export const CreateNotionItemFunction = DefineFunction({
  callback_id: "create_notion_item",
  title: "Create Notion Database Item",
  description: "Create an item in a Notion database with configurable fields",
  source_file: "functions/create_notion_item.ts",
  input_parameters: {
    properties: {
      database_id: {
        type: Schema.types.string,
        description: "Notion Database ID (32-character string)",
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
    },
    required: ["database_id"],
  },
  output_parameters: {
    properties: {
      page_id: {
        type: Schema.types.string,
        description: "Created Notion page ID",
      },
      page_url: {
        type: Schema.types.string,
        description: "URL of the created page",
      },
      success: {
        type: Schema.types.boolean,
        description: "Whether the operation was successful",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if operation failed",
      },
    },
    required: ["success"],
  },
});

export default SlackFunction(
  CreateNotionItemFunction,
  async ({ inputs, env }) => {
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

      // Get database ID from input
      const databaseId = inputs.database_id;

      // Collect field pairs from inputs
      const propertiesData: Record<string, unknown> = {};

      for (let i = 1; i <= 10; i++) {
        const fieldName = inputs[`field${i}_name`] as string;
        const fieldValue = inputs[`field${i}_value`] as string;

        if (fieldName && fieldValue) {
          propertiesData[fieldName] = fieldValue;
        }
      }

      const notionClient = new NotionClient(notionToken);

      // Get database schema to validate and convert properties
      const database = await notionClient.getDatabaseSchema(databaseId);
      const writableProperties = notionClient.getWritableProperties(database);

      // Convert input data to Notion properties format
      const notionProperties: Record<string, NotionPageProperty> = {};

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
          default:
            console.warn(`Unsupported property type: ${propertyDef.type}`);
        }
      }

      // Validate required properties
      const titleProperty = writableProperties.find((p) => p.type === "title");
      if (titleProperty && !notionProperties[titleProperty.name]) {
        return {
          outputs: {
            success: false,
            error: `Title field "${titleProperty.name}" is required`,
          },
        };
      }

      // Create the Notion page
      const createRequest: NotionCreatePageRequest = {
        parent: { database_id: databaseId },
        properties: notionProperties,
      };

      const createdPage = await notionClient.createPage(createRequest);

      return {
        outputs: {
          page_id: createdPage.id,
          page_url: createdPage.url,
          success: true,
        },
      };
    } catch (error) {
      console.error("Error creating Notion item:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error occurred";
      return {
        outputs: {
          success: false,
          error: `Failed to create Notion item: ${errorMessage}`,
        },
      };
    }
  },
);
