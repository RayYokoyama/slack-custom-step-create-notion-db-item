import {
  NotionDatabaseProperty,
  NotionPageProperty,
} from "../../types/notion.ts";

/**
 * Collected field data from Slack function inputs
 */
export interface CollectedFields {
  propertiesData: Record<string, unknown>;
  userFieldsData: Record<string, string>;
}

/**
 * Result of converting fields to Notion properties
 */
export interface ConversionResult {
  notionProperties: Record<string, NotionPageProperty>;
  warnings: string[];
}

/**
 * Interface for user mapping functionality (for dependency injection)
 */
export interface UserMappingFunction {
  mapSingle(userId: string): Promise<{ notionUserId: string | null; error?: string }>;
  mapMultiple(userIds: string): Promise<Array<{ notionUserId: string | null; slackUserId: string; error?: string }>>;
}

/**
 * Collect field pairs from Slack function inputs (Pure function)
 */
export function collectFieldsFromInputs(
  inputs: Record<string, unknown>,
): CollectedFields {
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

  return { propertiesData, userFieldsData };
}

/**
 * Convert a single property value to Notion format (Pure function - excludes people type)
 * Returns null if the property type is not supported or conversion fails
 */
export function convertPropertyValue(
  fieldName: string,
  fieldValue: unknown,
  propertyType: string,
): NotionPageProperty | null {
  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
    return null;
  }

  switch (propertyType) {
    case "title":
      return {
        type: "title",
        title: [{ text: { content: String(fieldValue) } }],
      };

    case "rich_text":
      return {
        type: "rich_text",
        rich_text: [{ text: { content: String(fieldValue) } }],
      };

    case "number": {
      const numValue = typeof fieldValue === "number"
        ? fieldValue
        : parseFloat(String(fieldValue));
      if (isNaN(numValue)) {
        return null;
      }
      return {
        type: "number",
        number: numValue,
      };
    }

    case "select":
      return {
        type: "select",
        select: { name: String(fieldValue) },
      };

    case "multi_select": {
      const multiSelectValues = Array.isArray(fieldValue)
        ? fieldValue
        : [fieldValue];
      return {
        type: "multi_select",
        multi_select: multiSelectValues.map((v) => ({ name: String(v) })),
      };
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

      // Handle Slack timestamp format: "December 26th, 2025 at 1:04 AM UTC"
      const slackTimestampMatch = isoDate.match(
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{4})/i
      );
      if (slackTimestampMatch) {
        const monthNames: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04",
          may: "05", june: "06", july: "07", august: "08",
          september: "09", october: "10", november: "11", december: "12",
        };
        const month = monthNames[slackTimestampMatch[1].toLowerCase()];
        const day = slackTimestampMatch[2].padStart(2, "0");
        const year = slackTimestampMatch[3];
        isoDate = `${year}-${month}-${day}`;
      }

      // Validate ISO date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        console.warn(
          `Invalid date format for ${fieldName}: ${fieldValue}. Expected YYYY-MM-DD format.`,
        );
        return null;
      }

      return {
        type: "date",
        date: { start: isoDate },
      };
    }

    case "checkbox":
      return {
        type: "checkbox",
        checkbox: fieldValue === true || fieldValue === "true",
      };

    case "url":
      return {
        type: "url",
        url: String(fieldValue),
      };

    case "email":
      return {
        type: "email",
        email: String(fieldValue),
      };

    case "phone_number":
      return {
        type: "phone_number",
        phone_number: String(fieldValue),
      };

    default:
      return null;
  }
}

/**
 * Find property definition by name (Pure function)
 */
export function findPropertyDefinition(
  fieldName: string,
  writableProperties: NotionDatabaseProperty[],
): NotionDatabaseProperty | undefined {
  return writableProperties.find((p) => p.name === fieldName);
}

/**
 * Convert collected fields to Notion properties format
 * Uses dependency injection for user mapping to enable testing
 */
export async function convertToNotionProperties(
  collectedFields: CollectedFields,
  writableProperties: NotionDatabaseProperty[],
  userMapping: UserMappingFunction,
): Promise<ConversionResult> {
  const { propertiesData, userFieldsData } = collectedFields;
  const notionProperties: Record<string, NotionPageProperty> = {};
  const warnings: string[] = [];

  // Process user fields first (dedicated people properties)
  for (const [fieldName, userId] of Object.entries(userFieldsData)) {
    if (!userId) continue;

    const propertyDef = findPropertyDefinition(fieldName, writableProperties);
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

    const mappingResult = await userMapping.mapSingle(userId);

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
      warnings.push(warning);
    }
  }

  // Process regular fields
  for (const [fieldName, fieldValue] of Object.entries(propertiesData)) {
    if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
      continue;
    }

    const propertyDef = findPropertyDefinition(fieldName, writableProperties);
    if (!propertyDef) {
      console.warn(`Unknown property: ${fieldName}`);
      continue;
    }

    // Handle people type separately (requires async user mapping)
    if (propertyDef.type === "people") {
      const mappingResults = await userMapping.mapMultiple(String(fieldValue));

      const failedMappings = mappingResults.filter((r) => r.notionUserId === null);
      failedMappings.forEach((failed) => {
        const warning =
          `Failed to map Slack user ${failed.slackUserId}: ${failed.error || "Unknown error"}`;
        console.warn(warning);
        warnings.push(warning);
      });

      const validUserIds = mappingResults
        .filter((r) => r.notionUserId !== null)
        .map((r) => r.notionUserId as string);

      if (validUserIds.length > 0) {
        notionProperties[fieldName] = {
          type: "people",
          people: validUserIds.map((id) => ({ id })),
        };
      } else if (mappingResults.length > 0) {
        console.warn(
          `No valid Notion users found for people property: ${fieldName}`,
        );
      }
      continue;
    }

    // Use pure function for non-people types
    const converted = convertPropertyValue(fieldName, fieldValue, propertyDef.type);
    if (converted) {
      notionProperties[fieldName] = converted;
    } else {
      console.warn(`Unsupported or invalid property: ${fieldName} (type: ${propertyDef.type})`);
    }
  }

  return { notionProperties, warnings };
}
