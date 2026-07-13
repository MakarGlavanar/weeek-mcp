# weeek-mcp-server

MCP (Model Context Protocol) server for the [WEEEK](https://weeek.net) task tracker. Gives AI coding agents (Claude Desktop, Cursor, Cline, and any other MCP client) direct read/write access to WEEEK projects, boards, tasks, and comments — no context switching.

## Features

- **16 tools** — 10 read (projects, boards, columns, tasks, workspace members, CRM funnels/statuses/deals) + 6 write (create/update/move/complete tasks, set MR link, create CRM deal)
- **Read/write split** — tools are grouped so MCP clients can auto-approve reads while gating writes
- **Stdio transport** — zero server infrastructure, runs via `npx`
- **Token auth** — single `WEEEK_API_TOKEN` env var, never logged
- **Safe defaults** — list tools paginate (default 20, max 50) so responses stay under the 25k token MCP limit
- **Structured errors** — API failures return `isError: true` with a human-readable message, the server never crashes

## Installation

No installation needed — configure your MCP client to run it via `npx`.

## Getting a WEEEK API Token

1. Sign in to [WEEEK](https://weeek.net).
2. Open **Workspace settings → API**.
3. Generate a personal API token.
4. Treat it like a password — it grants full read/write access to your workspace. Rotate it if it leaks.

## Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "weeek": {
      "command": "npx",
      "args": ["-y", "weeek-mcp-server"],
      "env": {
        "WEEEK_API_TOKEN": "your-weeek-token-here"
      }
    }
  }
}
```

Restart Claude Desktop.

### Cursor

Edit `~/.cursor/mcp.json` (or use **Cursor Settings → MCP → Add new MCP server**):

```json
{
  "mcpServers": {
    "weeek": {
      "command": "npx",
      "args": ["-y", "weeek-mcp-server"],
      "env": {
        "WEEEK_API_TOKEN": "your-weeek-token-here"
      }
    }
  }
}
```

### Generic MCP client

Any MCP client that supports stdio transport can launch:

```
command: npx
args: ["-y", "weeek-mcp-server"]
env: { WEEEK_API_TOKEN: "<your token>" }
```

## NVM Workaround (IMPORTANT for nvm users)

If you installed Node via [nvm](https://github.com/nvm-sh/nvm), GUI applications (Claude Desktop, Cursor) do **not** source your shell startup files, so `npx` is not on their `PATH`. You will see `spawn npx ENOENT` in the client logs.

**Fix:** use the absolute path to your nvm npx binary.

1. In your terminal, run:
   ```bash
   which npx
   ```
   Example output: `/Users/you/.nvm/versions/node/v22.0.0/bin/npx`

2. Put that absolute path in your MCP client config as the `command`:

   ```json
   {
     "mcpServers": {
       "weeek": {
         "command": "/Users/you/.nvm/versions/node/v22.0.0/bin/npx",
         "args": ["-y", "weeek-mcp-server"],
         "env": {
           "WEEEK_API_TOKEN": "your-weeek-token-here"
         }
       }
     }
   }
   ```

This is the single most common setup failure across all npx-based MCP servers. If you upgrade Node via nvm, update the path.

## Tools

All tools are prefixed `weeek_`. Read tools are side-effect free and safe for auto-approve. Write tools mutate WEEEK state and should prompt for user confirmation.

### Read tools

| Tool | Purpose |
|------|---------|
| `weeek_list_projects` | List projects in the workspace. Use FIRST to discover project IDs. |
| `weeek_get_project` | Get a single project's full details by ID. |
| `weeek_list_boards` | List boards inside a project. |
| `weeek_list_board_columns` | List columns (statuses) inside a board. Required before moving tasks. |
| `weeek_list_tasks` | List tasks with filters (project, board, column, assignee, completion) and pagination. Surfaces each task's `dueDate` / `dueDateTime`. |
| `weeek_get_task` | Get full details of a single task by ID. |
| `weeek_list_workspace_members` | List workspace members (user UUIDs) for assigning tasks/deals. |
| `weeek_list_funnels` | List CRM sales funnels (pipelines). Start here for deal work. |
| `weeek_list_funnel_statuses` | List the statuses (stages) of one CRM funnel. |
| `weeek_list_deals` | List deals within one CRM funnel status. |

### Write tools

| Tool | Purpose |
|------|---------|
| `weeek_create_task` | Create a NEW task. Requires title + project_id. Optional `due_date` / `start_date` accept `YYYY-MM-DD` or an ISO 8601 timestamp. |
| `weeek_update_task` | Edit fields (title, description, priority, assignee, `due_date`, `start_date`) of an existing task. |
| `weeek_move_task` | Move a task to a different board column (status change). |
| `weeek_complete_task` | Mark a task complete, or reopen a completed task. |
| `weeek_set_task_mr_link` | Record a merge-request link on a task's МР custom field. |
| `weeek_create_deal` | Create a NEW CRM deal in a funnel status. Requires status_id + title. |

## Safety

- **Read/write separation:** read tools and write tools are registered in separate groups. Configure your MCP client to auto-approve reads while gating writes.
- **No delete operations:** v1 intentionally does not expose delete endpoints — too destructive for an AI agent.
- **Pagination defaults:** list tools default to 20 results (max 50) to stay under the 25,000 token MCP response cap.
- **Token handling:** `WEEEK_API_TOKEN` is read from the `env` block only. It is never logged, echoed, or included in error messages.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `spawn npx ENOENT` in client logs | You are using nvm — see the [NVM Workaround](#nvm-workaround-important-for-nvm-users) section above. |
| `WEEEK_API_TOKEN environment variable is required` | The `env` block is missing or empty in your MCP client config. |
| `Invalid WEEEK_API_TOKEN` | Token is wrong, revoked, or expired — regenerate in WEEEK workspace settings. |
| Server disconnects immediately after starting | You are on Node < 20. Upgrade Node (`nvm install 20`) and update your config path. |
| Tool returns "Resource not found (404)" | The ID doesn't exist in the workspace — list the parent resource first (e.g., `weeek_list_projects` before `weeek_get_project`). |

## Development

```bash
git clone <this-repo>
cd weeek-mcp-server
npm install
npm run build
npm test
```

Scripts:
- `npm run build` — compile TypeScript to `dist/`
- `npm run dev` — run from source via `tsx`
- `npm run lint` — ESLint (enforces no-console rule for stdio safety)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest unit tests

To smoke-test the built binary:

```bash
npm run build
WEEEK_API_TOKEN=test node dist/index.js
# server blocks on stdin — press Ctrl+C to exit
```

## Requirements

- Node.js >= 20.0.0
- A WEEEK account with API access

## License

MIT — see [LICENSE](./LICENSE).
