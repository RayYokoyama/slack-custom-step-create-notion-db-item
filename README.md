# Notion Database Item Creator

Simple Slack app to create items in a predefined Notion database with
configurable field pairs.

## Quick Start

1. [Notion Setup](#notion-setup) - Create database and integration
2. [Environment Variables](#environment-variables) - Configure tokens
3. [Deploy](#deploy) - Deploy to Slack
4. [Usage](#usage) - Use in workflows

---

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
3. Copy the "Internal Integration Secret" (starts with `secret_`)
4. Share your database with the integration:
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
2. Add step: **"Collect info in a form"** (optional, or get data from other
   sources)
3. Add step: **"Create Notion Database Item"**
   - Configure the step:
     - **Database ID**: Enter your 32-character Notion database ID
     - **Field Pairs**: Add up to 10 property name/value pairs

### Configuration Format

**Database ID**: Get from your Notion database URL:

```
https://notion.so/workspace/DatabaseName-abc123def456789...
                                     ↑ This 32-character part
```

**Field Pairs**: Configure each field individually:

- Field 1 Name: Property name (e.g., "Name")
- Field 1 Value: Property value (e.g., "Task title here")
- Field 2 Name: Property name (e.g., "Status")
- Field 2 Value: Property value (e.g., "In Progress")
- ... (up to Field 10)

### Field Types Support

The function automatically detects your Notion database schema and converts
values appropriately:

| Notion Property Type | Example Value           | Notes                       |
| -------------------- | ----------------------- | --------------------------- |
| Title                | `Task Name`             | Required for most databases |
| Rich Text            | `Long description here` | Multi-line text             |
| Select               | `In Progress`           | Must match existing options |
| Multi-select         | `Tag1, Tag2`            | Comma-separated values      |
| Number               | `42`                    | Auto-converted              |
| Date                 | `2025-10-01`            | YYYY-MM-DD or YYYY/MM/DD   |
| Checkbox             | `true` or `false`       | Boolean values              |
| URL                  | `https://example.com`   | Valid URLs                  |
| Email                | `user@example.com`      | Valid email addresses       |

### Example Usage

**Step Configuration**:

- Database ID: `27babda449d480c69773d3ec52b714cd`
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

**Result**: Creates a new page in your Notion database with these properties

## Troubleshooting

- **"NOTION_TOKEN environment variable is not set"** - Use `slack env add NOTION_TOKEN your_token` **before** deploying
- **No output from deployed version** - Check that environment variables are properly set with `slack env list` before deployment
- **Works locally but not deployed** - Environment variables must be set with `slack env add` before deployment (`.env` file is only for local testing)
- **"Failed to create Notion item"** - Check integration has database access
- **Select field errors** - Ensure Notion database select options match exact field values
- **Empty fields** - Only fill Field Name AND Field Value pairs you want to use; empty pairs are ignored
