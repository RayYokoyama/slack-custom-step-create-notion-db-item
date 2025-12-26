import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectFieldsFromInputs,
  convertPropertyValue,
  convertToNotionProperties,
  findPropertyDefinition,
  UserMappingFunction,
} from "./property_converter.ts";
import { NotionDatabaseProperty } from "../../types/notion.ts";

// ============================================
// collectFieldsFromInputs tests (Pure function)
// ============================================

Deno.test("collectFieldsFromInputs - collects regular fields", () => {
  const inputs = {
    field1_name: "Title",
    field1_value: "Test Task",
    field2_name: "Status",
    field2_value: "In Progress",
    field3_name: "",
    field3_value: "ignored",
  };

  const result = collectFieldsFromInputs(inputs);

  assertEquals(result.propertiesData, {
    Title: "Test Task",
    Status: "In Progress",
  });
  assertEquals(result.userFieldsData, {});
});

Deno.test("collectFieldsFromInputs - collects user fields", () => {
  const inputs = {
    user_field1_name: "Assignee",
    user_field1_value: "U12345",
    user_field2_name: "Reviewer",
    user_field2_value: "U67890",
  };

  const result = collectFieldsFromInputs(inputs);

  assertEquals(result.propertiesData, {});
  assertEquals(result.userFieldsData, {
    Assignee: "U12345",
    Reviewer: "U67890",
  });
});

Deno.test("collectFieldsFromInputs - collects both regular and user fields", () => {
  const inputs = {
    field1_name: "Title",
    field1_value: "Test",
    user_field1_name: "Assignee",
    user_field1_value: "U12345",
  };

  const result = collectFieldsFromInputs(inputs);

  assertEquals(result.propertiesData, { Title: "Test" });
  assertEquals(result.userFieldsData, { Assignee: "U12345" });
});

Deno.test("collectFieldsFromInputs - ignores empty field names", () => {
  const inputs = {
    field1_name: "",
    field1_value: "ignored",
    field2_name: "Valid",
    field2_value: "value",
  };

  const result = collectFieldsFromInputs(inputs);

  assertEquals(result.propertiesData, { Valid: "value" });
});

Deno.test("collectFieldsFromInputs - ignores empty field values", () => {
  const inputs = {
    field1_name: "Name",
    field1_value: "",
    field2_name: "Valid",
    field2_value: "value",
  };

  const result = collectFieldsFromInputs(inputs);

  assertEquals(result.propertiesData, { Valid: "value" });
});

Deno.test("collectFieldsFromInputs - handles all 10 regular fields", () => {
  const inputs: Record<string, string> = {};
  for (let i = 1; i <= 10; i++) {
    inputs[`field${i}_name`] = `Field${i}`;
    inputs[`field${i}_value`] = `Value${i}`;
  }

  const result = collectFieldsFromInputs(inputs);

  assertEquals(Object.keys(result.propertiesData).length, 10);
  assertEquals(result.propertiesData["Field1"], "Value1");
  assertEquals(result.propertiesData["Field10"], "Value10");
});

// ============================================
// convertPropertyValue tests (Pure function)
// ============================================

Deno.test("convertPropertyValue - title type", () => {
  const result = convertPropertyValue("Name", "Test Title", "title");

  assertExists(result);
  assertEquals(result.type, "title");
  assertEquals(result.title, [{ text: { content: "Test Title" } }]);
});

Deno.test("convertPropertyValue - rich_text type", () => {
  const result = convertPropertyValue("Description", "Test text", "rich_text");

  assertExists(result);
  assertEquals(result.type, "rich_text");
  assertEquals(result.rich_text, [{ text: { content: "Test text" } }]);
});

Deno.test("convertPropertyValue - number type with number input", () => {
  const result = convertPropertyValue("Amount", 42, "number");

  assertExists(result);
  assertEquals(result.type, "number");
  assertEquals(result.number, 42);
});

Deno.test("convertPropertyValue - number type with string input", () => {
  const result = convertPropertyValue("Amount", "123.45", "number");

  assertExists(result);
  assertEquals(result.type, "number");
  assertEquals(result.number, 123.45);
});

Deno.test("convertPropertyValue - number type with invalid string returns null", () => {
  const result = convertPropertyValue("Amount", "not a number", "number");

  assertEquals(result, null);
});

Deno.test("convertPropertyValue - select type", () => {
  const result = convertPropertyValue("Status", "In Progress", "select");

  assertExists(result);
  assertEquals(result.type, "select");
  assertEquals(result.select, { name: "In Progress" });
});

Deno.test("convertPropertyValue - multi_select type with single value", () => {
  const result = convertPropertyValue("Tags", "Tag1", "multi_select");

  assertExists(result);
  assertEquals(result.type, "multi_select");
  assertEquals(result.multi_select, [{ name: "Tag1" }]);
});

Deno.test("convertPropertyValue - multi_select type with array", () => {
  const result = convertPropertyValue("Tags", ["Tag1", "Tag2"], "multi_select");

  assertExists(result);
  assertEquals(result.type, "multi_select");
  assertEquals(result.multi_select, [{ name: "Tag1" }, { name: "Tag2" }]);
});

Deno.test("convertPropertyValue - date type with ISO format", () => {
  const result = convertPropertyValue("DueDate", "2025-12-25", "date");

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-12-25" });
});

Deno.test("convertPropertyValue - date type converts slash format", () => {
  const result = convertPropertyValue("DueDate", "2025/1/5", "date");

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-01-05" });
});

Deno.test("convertPropertyValue - date type with invalid format returns null", () => {
  const result = convertPropertyValue("DueDate", "Dec 25, 2025", "date");

  assertEquals(result, null);
});

Deno.test("convertPropertyValue - date type converts Slack timestamp format", () => {
  const result = convertPropertyValue(
    "DueDate",
    "December 26th, 2025 at 1:04 AM UTC",
    "date",
  );

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-12-26" });
});

Deno.test("convertPropertyValue - date type converts Slack timestamp with 1st", () => {
  const result = convertPropertyValue(
    "DueDate",
    "January 1st, 2025 at 12:00 PM UTC",
    "date",
  );

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-01-01" });
});

Deno.test("convertPropertyValue - date type converts Slack timestamp with 2nd", () => {
  const result = convertPropertyValue(
    "DueDate",
    "February 2nd, 2025 at 3:30 PM UTC",
    "date",
  );

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-02-02" });
});

Deno.test("convertPropertyValue - date type converts Slack timestamp with 3rd", () => {
  const result = convertPropertyValue(
    "DueDate",
    "March 3rd, 2025 at 9:15 AM UTC",
    "date",
  );

  assertExists(result);
  assertEquals(result.type, "date");
  assertEquals(result.date, { start: "2025-03-03" });
});

Deno.test("convertPropertyValue - checkbox type with true", () => {
  const result = convertPropertyValue("Done", true, "checkbox");

  assertExists(result);
  assertEquals(result.type, "checkbox");
  assertEquals(result.checkbox, true);
});

Deno.test("convertPropertyValue - checkbox type with string 'true'", () => {
  const result = convertPropertyValue("Done", "true", "checkbox");

  assertExists(result);
  assertEquals(result.type, "checkbox");
  assertEquals(result.checkbox, true);
});

Deno.test("convertPropertyValue - checkbox type with false", () => {
  const result = convertPropertyValue("Done", false, "checkbox");

  assertExists(result);
  assertEquals(result.type, "checkbox");
  assertEquals(result.checkbox, false);
});

Deno.test("convertPropertyValue - url type", () => {
  const result = convertPropertyValue("Link", "https://example.com", "url");

  assertExists(result);
  assertEquals(result.type, "url");
  assertEquals(result.url, "https://example.com");
});

Deno.test("convertPropertyValue - email type", () => {
  const result = convertPropertyValue("Email", "test@example.com", "email");

  assertExists(result);
  assertEquals(result.type, "email");
  assertEquals(result.email, "test@example.com");
});

Deno.test("convertPropertyValue - phone_number type", () => {
  const result = convertPropertyValue("Phone", "+1-234-567-8900", "phone_number");

  assertExists(result);
  assertEquals(result.type, "phone_number");
  assertEquals(result.phone_number, "+1-234-567-8900");
});

Deno.test("convertPropertyValue - unsupported type returns null", () => {
  const result = convertPropertyValue("Unknown", "value", "unsupported_type");

  assertEquals(result, null);
});

Deno.test("convertPropertyValue - null value returns null", () => {
  const result = convertPropertyValue("Name", null, "title");

  assertEquals(result, null);
});

Deno.test("convertPropertyValue - empty string returns null", () => {
  const result = convertPropertyValue("Name", "", "title");

  assertEquals(result, null);
});

// ============================================
// findPropertyDefinition tests (Pure function)
// ============================================

Deno.test("findPropertyDefinition - finds existing property", () => {
  const properties: NotionDatabaseProperty[] = [
    { id: "1", name: "Title", type: "title" },
    { id: "2", name: "Status", type: "select" },
  ];

  const result = findPropertyDefinition("Status", properties);

  assertExists(result);
  assertEquals(result.name, "Status");
  assertEquals(result.type, "select");
});

Deno.test("findPropertyDefinition - returns undefined for non-existent property", () => {
  const properties: NotionDatabaseProperty[] = [
    { id: "1", name: "Title", type: "title" },
  ];

  const result = findPropertyDefinition("NonExistent", properties);

  assertEquals(result, undefined);
});

// ============================================
// convertToNotionProperties tests (with mock UserMapping)
// ============================================

function createMockUserMapping(
  mappings: Record<string, string>,
): UserMappingFunction {
  return {
    mapSingle: async (userId: string) => {
      const notionUserId = mappings[userId] || null;
      return {
        notionUserId,
        error: notionUserId ? undefined : `User ${userId} not found`,
      };
    },
    mapMultiple: async (userIds: string) => {
      const ids = userIds.split(",").map((id) => id.trim());
      return ids.map((id) => ({
        notionUserId: mappings[id] || null,
        slackUserId: id,
        error: mappings[id] ? undefined : `User ${id} not found`,
      }));
    },
  };
}

const sampleProperties: NotionDatabaseProperty[] = [
  { id: "1", name: "Title", type: "title" },
  { id: "2", name: "Status", type: "select" },
  { id: "3", name: "Priority", type: "number" },
  { id: "4", name: "Assignee", type: "people" },
  { id: "5", name: "DueDate", type: "date" },
];

Deno.test("convertToNotionProperties - converts regular fields", async () => {
  const collectedFields = {
    propertiesData: {
      Title: "Test Task",
      Status: "In Progress",
      Priority: "5",
    },
    userFieldsData: {},
  };

  const mockMapping = createMockUserMapping({});

  const result = await convertToNotionProperties(
    collectedFields,
    sampleProperties,
    mockMapping,
  );

  assertEquals(result.warnings.length, 0);
  assertExists(result.notionProperties["Title"]);
  assertEquals(result.notionProperties["Title"].type, "title");
  assertExists(result.notionProperties["Status"]);
  assertEquals(result.notionProperties["Status"].type, "select");
  assertExists(result.notionProperties["Priority"]);
  assertEquals(result.notionProperties["Priority"].type, "number");
  assertEquals(result.notionProperties["Priority"].number, 5);
});

Deno.test("convertToNotionProperties - converts user fields with successful mapping", async () => {
  const collectedFields = {
    propertiesData: {},
    userFieldsData: {
      Assignee: "U12345",
    },
  };

  const mockMapping = createMockUserMapping({
    U12345: "notion-user-123",
  });

  const result = await convertToNotionProperties(
    collectedFields,
    sampleProperties,
    mockMapping,
  );

  assertEquals(result.warnings.length, 0);
  assertExists(result.notionProperties["Assignee"]);
  assertEquals(result.notionProperties["Assignee"].type, "people");
  assertEquals(result.notionProperties["Assignee"].people, [{ id: "notion-user-123" }]);
});

Deno.test("convertToNotionProperties - adds warning for failed user mapping", async () => {
  const collectedFields = {
    propertiesData: {},
    userFieldsData: {
      Assignee: "U99999",
    },
  };

  const mockMapping = createMockUserMapping({});

  const result = await convertToNotionProperties(
    collectedFields,
    sampleProperties,
    mockMapping,
  );

  assertEquals(result.warnings.length, 1);
  assertEquals(result.notionProperties["Assignee"], undefined);
});

Deno.test("convertToNotionProperties - skips unknown properties", async () => {
  const collectedFields = {
    propertiesData: {
      UnknownField: "value",
      Title: "Test",
    },
    userFieldsData: {},
  };

  const mockMapping = createMockUserMapping({});

  const result = await convertToNotionProperties(
    collectedFields,
    sampleProperties,
    mockMapping,
  );

  assertEquals(Object.keys(result.notionProperties).length, 1);
  assertExists(result.notionProperties["Title"]);
});

Deno.test("convertToNotionProperties - handles mixed fields correctly", async () => {
  const collectedFields = {
    propertiesData: {
      Title: "Test Task",
      DueDate: "2025-12-25",
    },
    userFieldsData: {
      Assignee: "U12345",
    },
  };

  const mockMapping = createMockUserMapping({
    U12345: "notion-user-123",
  });

  const result = await convertToNotionProperties(
    collectedFields,
    sampleProperties,
    mockMapping,
  );

  assertEquals(result.warnings.length, 0);
  assertEquals(Object.keys(result.notionProperties).length, 3);
  assertExists(result.notionProperties["Title"]);
  assertExists(result.notionProperties["DueDate"]);
  assertExists(result.notionProperties["Assignee"]);
});
