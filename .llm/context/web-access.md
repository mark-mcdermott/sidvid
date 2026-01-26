# Application Access

## Development Environment

### Web UI (SvelteKit)
- **Dev Server:** Launched via `pnpm dev`
- **URL:** http://localhost:5173 (default Vite port)
- **DevTools:** Browser developer tools (F12)

### CLI
- **Wrapper Script:** `./sidvid <command>`
- **Direct:** `pnpm cli <command>`
- **Help:** `./sidvid help`

## Playwright MCP Server

This project has a Playwright MCP server configured for browser automation and testing. Agents can use it to:

**Navigation & Inspection:**
- `mcp__playwright__browser_navigate` - Navigate to URLs
- `mcp__playwright__browser_snapshot` - Get accessibility tree (best for element inspection)
- `mcp__playwright__browser_take_screenshot` - Capture visual state

**Interaction:**
- `mcp__playwright__browser_click` - Click elements
- `mcp__playwright__browser_type` - Type into fields
- `mcp__playwright__browser_fill_form` - Fill multiple form fields
- `mcp__playwright__browser_select_option` - Select dropdown options
- `mcp__playwright__browser_hover` - Hover over elements

**Debugging:**
- `mcp__playwright__browser_console_messages` - View console output
- `mcp__playwright__browser_network_requests` - View network activity
- `mcp__playwright__browser_evaluate` - Run JavaScript in page

**Tab Management:**
- `mcp__playwright__browser_tabs` - List, create, close, or select tabs
- `mcp__playwright__browser_close` - Close the browser

Use Playwright MCP for:
- Interactive test development and debugging
- Visual verification of UI changes
- Exploratory testing
- Debugging E2E test failures
- Verifying accessibility tree structure

## External APIs

### OpenAI API
- **ChatGPT:** Used for story generation, editing, and character enhancement
- **DALL-E 3:** Used for character and scene image generation
- **Authentication:** API key in `OPENAI_API_KEY` environment variable
- **Documentation:** https://platform.openai.com/docs

### Kling AI API (Video Generation)
- **Purpose:** Video generation from storyboards
- **Authentication:** API key in `KLING_API_KEY` environment variable
- **Status:** Integration planned but not complete

## Security Notes

- Store API keys in `.env` file (gitignored)
- Never commit API keys to the repository
- Use `.env.example` as a template for required keys
- API keys are passed to the library via constructor options

## No Backend Services

SidVid is a client-side library with no backend:
- No database (sessions stored locally via adapters)
- No user authentication (users provide their own API keys)
- No cloud hosting (library runs in user's environment)
- No server deployment (UI is for local development only)
