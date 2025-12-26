# Notion Database Item Creator

Simple Slack app to create and update items in Notion databases with
configurable field pairs.

## Quick Start

1. [Project Setup](#project-setup) - Initialize Slack project
2. [Notion Setup](#notion-setup) - Create database and integration
3. [Environment Variables](#environment-variables) - Configure tokens
4. [Deploy](#deploy) - Deploy to Slack
5. [Usage](#usage) - Use in workflows

---

## Project Setup

Initialize the Slack project in your workspace:

```bash
# Clone the repository
git clone git@github.com:RayYokoyama/slack-custom-step-create-notion-db-item.git
cd slack-custom-step-create-notion-db-item

# Initialize Slack project
slack init

# Follow the prompts to:
# - Choose your Slack workspace
# - Select "Create a new app"
# - Use the existing manifest.ts file
```

## Notion Setup

### 1. Create Notion Database

Create a Notion database with any properties you need. The app automatically detects your database schema and supports all property types.

**Example properties** (customize as needed):
- **Name** (Title) - Typically required
- **Description** (Text)
- **Status** (Select)
- **Priority** (Select)
- **Due Date** (Date)

### 2. Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. **Enable "User capabilities"** under "Capabilities" (required for people properties)
4. Copy the "Internal Integration Secret" (starts with `secret_`)
5. Share your database with the integration:
   - Open your Notion database
   - Click "Connections" in the top-right
   - Add Connection and select your integration

## Environment Variables

Copy `.env.sample` to `.env` and fill in your values:

```bash
cp .env.sample .env
```

Set this variable:

- `NOTION_TOKEN` - Your integration secret token

Note: Database ID is now configured per workflow step, not as an environment
variable.

## Deploy

### Local Testing

For local development and testing:

```bash
slack run
```

This starts a local development server where you can test the workflow step before deploying.

### Production Deployment

Set up environment variables:

```bash
# Add NOTION_TOKEN (required)
slack env add NOTION_TOKEN your_notion_token_here

# Check current environment variables
slack env list
```

Then deploy:

```bash
slack deploy
```

## Usage

### In Slack Workflows

1. Create a new workflow in Slack
2. Add step: **"Collect info in a form"** (optional, or get data from other sources)
3. Add step: **"Create Notion Database Item"**
   - Configure the step:
     - **Database ID**: Enter your 32-character Notion database ID
     - **User Fields** (for people properties): Up to 3 user field name/value pairs
     - **Regular Field Pairs**: Up to 10 property name/value pairs for other types

### Configuration Format

**Database ID**: Get from your Notion database URL:

```
https://notion.so/workspace/DatabaseName-abc123def456789...
                                     ↑ This 32-character part
```

**User Fields** (for Notion people properties):
- User Field 1 Name: Property name (e.g., "Assignee")
- User Field 1 Value: Select a Slack user (uses `user_id` type)
- User Field 2-3: Additional people properties (optional)

**Regular Field Pairs**: Configure each field individually:
- Field 1 Name: Property name (e.g., "Name")
- Field 1 Value: Property value (e.g., "Task title here")
- Field 2 Name: Property name (e.g., "Status")
- Field 2 Value: Property value (e.g., "In Progress")
- ... (up to Field 10)

### Field Types Support

The function automatically detects your Notion database schema and converts
values appropriately:

| Notion Property Type | Example Value           | Notes                                        |
| -------------------- | ----------------------- | -------------------------------------------- |
| Title                | `Task Name`             | Required for most databases                  |
| Rich Text            | `Long description here` | Multi-line text                              |
| Select               | `In Progress`           | Must match existing options                  |
| Multi-select         | `Tag1, Tag2`            | Comma-separated values                       |
| Number               | `42`                    | Auto-converted                               |
| Date                 | `2025-10-01`            | YYYY-MM-DD or YYYY/MM/DD                    |
| Checkbox             | `true` or `false`       | Boolean values                               |
| URL                  | `https://example.com`   | Valid URLs                                   |
| Email                | `user@example.com`      | Valid email addresses                        |
| **People**           | Use User Fields         | **Use dedicated user field inputs (recommended)** or comma-separated user IDs |

### Example Usage

**Step Configuration**:

- Database ID: `27babda449d480c69773d3ec52b714cd`
- **User Field 1 Name**: `Assignee`
- **User Field 1 Value**: `{Insert variable: User from form}` ← Use Slack's user selector
- Field 1 Name: `Name`
- Field 1 Value: `Review quarterly report`
- Field 2 Name: `Description`
- Field 2 Value: `Analyze Q3 financial data and prepare summary`
- Field 3 Name: `Status`
- Field 3 Value: `Not Started`
- Field 4 Name: `Priority`
- Field 4 Value: `High`
- Field 5 Name: `Due Date`
- Field 5 Value: `2025-10-01`

**Result**: Creates a new page in your Notion database with these properties, with the Assignee properly mapped from Slack to Notion

### People Properties Setup

To use people properties, you need to ensure:

1. **Slack App Permissions**: The app has `users:read` and `users:read.email` scopes (already configured)
2. **Notion Integration**: "User capabilities" is enabled in your Notion integration settings
3. **Matching Emails**: Users must have the same email address in both Slack and Notion workspaces

**How it works**:
1. You select a Slack user in the workflow using User Field inputs
2. The app fetches the user's email from Slack
3. The app finds the matching Notion user by email
4. The Notion page is created with the correct person assigned

**Note**: If a user cannot be mapped, the app will still create the page but log a warning in the `user_mapping_warnings` output parameter.

---

## Update Notion Database Item

You can also update existing Notion database items using the **"Update Notion Database Item"** step.

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page_id` | string | Yes | The Notion page ID to update |
| `field1_name` ~ `field10_name` | string | No | Property name |
| `field1_value` ~ `field10_value` | string | No | Property value |
| `user_field1_name` ~ `user_field3_name` | string | No | User property name |
| `user_field1_value` ~ `user_field3_value` | user_id | No | Slack user ID |

### Output Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page_id` | string | Updated page ID |
| `page_url` | string | URL of the updated page |
| `success` | boolean | Whether the operation succeeded |
| `error` | string | Error message if failed |
| `user_mapping_warnings` | string | Warnings about failed user mappings |

### Getting the Page ID

You can get the page ID from:

1. **Previous Create step**: Use the `page_id` output from a "Create Notion Database Item" step
2. **Notion URL**: Extract from the page URL:
   ```
   https://notion.so/workspace/PageTitle-abc123def456789...
                                        ↑ This 32-character part (with dashes removed)
   ```

### Example Usage

**Workflow: Create then Update**

1. Add step: **"Create Notion Database Item"**
   - Creates a new item and outputs `page_id`

2. Add step: **"Update Notion Database Item"**
   - **Page ID**: `{{steps.create_notion_item.page_id}}`
   - **Field 1 Name**: `Status`
   - **Field 1 Value**: `In Progress`

**Note**: Only the specified fields are updated; other fields remain unchanged (partial update).

## Troubleshooting

### General Issues
- **"NOTION_TOKEN environment variable is not set"** - Use `slack env add NOTION_TOKEN your_token` **before** deploying
- **No output from deployed version** - Check that environment variables are properly set with `slack env list` before deployment
- **Works locally but not deployed** - Environment variables must be set with `slack env add` before deployment (`.env` file is only for local testing)
- **"Failed to create Notion item"** - Check integration has database access
- **Select field errors** - Ensure Notion database select options match exact field values
- **Empty fields** - Only fill Field Name AND Field Value pairs you want to use; empty pairs are ignored

### People Property Issues
- **"Slack user has no email address"** - Make sure your Slack app has been reinstalled after adding `users:read.email` scope
- **"No Notion user found with email"** - Ensure:
  - The user exists in your Notion workspace
  - The email addresses match exactly in both Slack and Notion
  - "User capabilities" is enabled in your Notion integration settings
- **User mapping warnings** - Check the `user_mapping_warnings` output parameter for detailed error messages
- **Invalid user ID format** - Use the dedicated User Field inputs (user_field1-3) instead of regular field inputs for people properties
