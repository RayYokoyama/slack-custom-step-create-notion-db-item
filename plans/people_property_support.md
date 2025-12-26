# Implementation Plan: Slack-to-Notion People Property Support

## Overview
Add support for converting Slack user IDs/mentions to Notion people properties by implementing user mapping between Slack and Notion workspaces.

## Architecture Design

### User Mapping Strategy
- **Primary matching method**: Email-based matching (most reliable)
- **Fallback method**: Name-based matching (less reliable, optional)
- **Caching**: Store user mappings to avoid repeated API calls

### Data Flow
1. Receive Slack user ID or mention (e.g., `U1234567` or `<@U1234567>`)
2. Fetch Slack user info (email, real name)
3. Fetch Notion workspace users
4. Match users by email
5. Return Notion user ID
6. Format as Notion people property

## Implementation Tasks

### 1. Update Types (types/notion.ts)
- Add `NotionUser` interface for Notion user objects
- Add `NotionUsersListResponse` interface
- Ensure `NotionPageProperty` people field is properly typed

### 2. Enhance NotionClient (functions/utils/notion_client.ts)
- Add `listUsers()` method to fetch all Notion workspace users
- Add caching mechanism for user list (optional but recommended)

**API Details**:
```
GET https://api.notion.com/v1/users
```

### 3. ~~Create SlackClient~~ Use Slack Client Directly (NO NEW FILE NEEDED)
- **Don't create a separate SlackClient class** - use the built-in `client` from SlackFunction context
- Access via: `({ inputs, client }) => { ... }`
- Make API calls using: `await client.users.info({ user: userId })`
- The client automatically handles token management

**API Details**:
```
Slack API: users.info
Required scopes: users:read AND users:read.email
```

**Reasoning**: Creating a wrapper class is unnecessary complexity. The deno-slack-sdk already provides an authenticated client with automatic token management.

### 4. Create UserMapper (functions/utils/user_mapper.ts) - NEW FILE
- Create `UserMapper` class to handle mapping logic
- Constructor should accept both `slackClient` and `notionClient`
- Add `mapSlackUserToNotionUser()` method
  - Accept Slack user ID
  - Fetch Slack user info
  - Fetch Notion users
  - Match by email (primary)
  - Return Notion user ID or null

**Matching Logic**:
```typescript
1. Parse Slack user ID (strip <@...> if needed)
2. Call slackClient.users.info({ user: slackUserId })
3. Extract email from response.user.profile.email
4. Call notionClient.listUsers()
5. Find Notion user where user.type === "person" && user.person?.email === slackEmail
6. Return notionUser.id or null if not found
```

**Note**: Email field is at `user.profile.email` in Slack, and `user.person.email` in Notion (only for type="person")

### 5. Update Main Function (functions/create_notion_item.ts)
- **Update SlackFunction signature** to include `client` parameter: `async ({ inputs, env, client }) => { ... }`
- Create UserMapper instance with both clients
- Add `people` case to property conversion switch statement
- Integrate UserMapper to convert Slack user ID to Notion user ID
- Handle multiple users (comma-separated Slack user IDs)
- Add error handling for unmapped users

**Implementation Location**: Line 181-272 (property conversion switch)

**Code Structure**:
```typescript
// At function start (line ~127)
const userMapper = new UserMapper(client, notionClient);

// In switch statement
case "people": {
  // Parse Slack user IDs (handle <@U123>, U123, or comma-separated)
  const slackUserIds = String(fieldValue).split(',').map(id => id.trim());

  // Use UserMapper to convert each Slack ID to Notion ID
  const notionUserIds = await Promise.all(
    slackUserIds.map(id => userMapper.mapSlackUserToNotionUser(id))
  );

  // Filter out null results (users not found)
  const validUserIds = notionUserIds.filter(id => id !== null);

  if (validUserIds.length > 0) {
    notionProperties[fieldName] = {
      type: "people",
      people: validUserIds.map(id => ({ id }))
    };
  }
  break;
}
```

### 6. Update Manifest (manifest.ts)
- Add `users:read` scope to `botScopes` array
- Add `users:read.email` scope to `botScopes` array
- **Both scopes are required** to call Slack's `users.info` API and access email addresses

### 7. Error Handling & Logging
- Log warnings when users cannot be mapped
- Provide clear error messages:
  - "Slack user not found"
  - "Notion user not found (no email match)"
  - "Multiple Notion users found with same email"
- Don't fail the entire operation if one user mapping fails
- Continue with successfully mapped users

## Input Format Options

Support multiple input formats for flexibility:
1. Single Slack user ID: `U1234567`
2. Slack mention format: `<@U1234567>`
3. Multiple users (comma-separated): `U1234567,U7654321`
4. Multiple mentions: `<@U1234567>,<@U7654321>`

## Edge Cases to Handle

1. **User not in both workspaces**: Log warning, skip user
2. **No email in Slack profile**: Cannot map, log error
3. **Multiple Notion users with same email**: Use first match, log warning
4. **Invalid Slack user ID**: Validate format, return error
5. **Notion API rate limits**: Consider implementing retry logic
6. **Empty people field**: Skip property entirely
7. **Missing Slack permissions**: If `users:read.email` not granted, email will be undefined
8. **Missing Notion user capabilities**: API will return 403 or email field missing
9. **Guests in Notion**: Guests are NOT returned by `/users` endpoint, cannot be mapped

## Testing Considerations

1. Test with valid Slack user ID
2. Test with Slack mention format
3. Test with multiple users
4. Test with non-existent Slack user
5. Test with Slack user not in Notion workspace
6. Test with user without email in Slack
7. Test with empty/null input

## API Permissions Required

### Slack
- `users:read` - to fetch user information
- `users:read.email` - **CRITICAL: Required to access email field** (apps created after Jan 4, 2017 require both scopes)
- Already have `workflow.steps:execute`

### Notion
- **CRITICAL: Integration must have "User capabilities" enabled to access email**
- User read access alone is NOT sufficient - must explicitly enable user capabilities in integration settings
- Without user capabilities, API returns 403 or email field will be missing

## Performance Considerations

1. **User list caching**: Cache Notion user list for 5-10 minutes
2. **Slack user info caching**: Consider caching if same users appear frequently
3. **Batch operations**: If possible, batch Slack user lookups
4. **Lazy loading**: Only fetch users when people property is used

## Migration Notes

- This is a new feature, no breaking changes
- Existing functionality remains unchanged
- People property support is additive

## Future Enhancements (Out of Scope)

1. Support for name-based matching as fallback
2. Admin UI to manually map users
3. Cache persistence across function invocations
4. Support for Notion groups/teams
5. Bidirectional mapping (Notion → Slack)

## File Structure Summary

```
.
├── types/
│   └── notion.ts (UPDATE: Add NotionUser types)
├── functions/
│   ├── create_notion_item.ts (UPDATE: Add client param, people case)
│   └── utils/
│       ├── notion_client.ts (UPDATE: Add listUsers method)
│       └── user_mapper.ts (NEW: Create mapping logic)
└── manifest.ts (UPDATE: Add users:read + users:read.email scopes)
```

**Note**: No separate SlackClient file needed - using built-in client from SlackFunction context

## Implementation Order

1. Update manifest (add Slack permissions first)
2. Update types (foundation)
3. Enhance NotionClient (Notion users API)
4. Create UserMapper (core mapping logic)
5. Update create_notion_item.ts (integrate into main flow with client param)
6. Test end-to-end
7. Document setup requirements for users

## Estimated Complexity

- **Low complexity**: Type updates, manifest changes
- **Medium complexity**: NotionClient enhancements, UserMapper implementation
- **High complexity**: Error handling, edge cases, permission setup documentation

## CRITICAL Setup Requirements

Users must complete these steps for the feature to work:

1. **Slack App Configuration**:
   - Reinstall app after adding `users:read.email` scope
   - Permission changes require OAuth token refresh

2. **Notion Integration Configuration**:
   - Go to Notion integration settings
   - Enable "User capabilities" under "Capabilities"
   - Without this, email field will not be accessible

3. **User Account Requirements**:
   - Users must have email addresses in both Slack and Notion
   - Emails must match exactly for mapping to work
   - Notion guests cannot be mapped (not returned by API)
