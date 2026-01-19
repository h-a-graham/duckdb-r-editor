# Claude Code Context for DuckDB R Editor

## Quick Reference

**Extension**: TypeScript for Positron IDE
**Purpose**: SQL syntax highlighting and autocomplete for DuckDB in R files
**Key Feature**: Direct R session integration via Positron API - no file locking

## Architecture

### Core Components

1. **PositronSchemaProvider** - Queries R session for schema
   - Silent R code execution with file-based I/O
   - Connection-specific (supports `:memory:`)
   - Auto-refresh on schema changes

2. **DuckDBFunctionProvider** - Hybrid function system
   - Node.js provides ~900 base functions
   - R session functions override when connected
   - Auto-load official extensions via settings

3. **SQLCompletionProvider** - Context-aware autocomplete
   - Tables, columns, functions, keywords
   - Works in: `dbExecute`, `dbGetQuery`, `sql()`, `glue_sql()`
   - Connection name extraction from arguments

4. **SQL Highlighting** - Three layers
   - Semantic tokens (default, O(n))
   - TextMate grammar (fallback)
   - Background decorator (theme-aware)

### Key Files

- `src/extension.ts` - Main entry, connection management, auto-refresh
- `src/positronSchemaProvider.ts` - R session queries
- `src/functionProvider.ts` - Hybrid functions
- `src/completionProvider.ts` - Autocomplete logic
- `src/sqlStringDetector.ts` - SQL string detection
- `src/semanticTokenProvider.ts` - Syntax highlighting
- `src/sqlBackgroundDecorator.ts` - Visual backgrounds

## Important Implementation Details

### Connection Workflow
1. User: Command Palette → "Connect to DuckDB Database"
2. Extension: Discovers R connections via silent execution
3. User: Selects connection from QuickPick (e.g., "con")
4. Extension: Queries schema and functions from R
5. Extension: Merges R functions with Node.js base
6. Ready: Autocomplete active!

### Auto-Refresh
- Triggers on: CREATE/DROP/ALTER, INSERT/UPDATE/DELETE, INSTALL/LOAD
- Debounced: 1.5s delay to batch changes
- Detects: Connection name in executed code
- Notifications: Shows table/function count changes
- Silent: No R console pollution

### Hybrid Functions
- **Before connecting**: Node.js functions available
- **After connecting**: R functions override (source of truth)
- **Extensions in R**: Automatically detected
- **Official extensions**: Load via command or settings

### SQL Detection
- Functions: `dbExecute`, `dbGetQuery`, `sql()`, `glue_sql()`
- Scope validation: Proper parenthesis matching
- Connection extraction: From function arguments
- Glue support: Handles `{}` interpolation blocks

## Settings

```json
{
  "duckdb-r-editor.enableAutoComplete": true,
  "duckdb-r-editor.useSemanticHighlighting": true,
  "duckdb-r-editor.autoRefreshSchema": true,
  "duckdb-r-editor.defaultExtensions": ["spatial", "httpfs"]
}
```

## Commands

- **Connect to DuckDB Database** - Select R connection
- **Disconnect from Database** - Clear connection
- **Refresh DuckDB Schema** - Manual update
- **Load DuckDB Extension** - One-time official extensions

## Performance

- **SQL detection**: O(n) algorithm, ~1-3ms per file
- **Document cache**: Invalidates on changes
- **R execution**: Silent mode, file-based I/O
- **Debouncing**: Prevents spam (1.5s)
- **Safety limits**: 1MB max document size

## Key Design Decisions

### Why Positron API?
- Direct R session access
- No file locking issues
- Supports `:memory:` databases
- Silent execution mode

### Why Hybrid Functions?
- Immediate autocomplete (Node.js)
- Accurate session state (R override)
- Best of both worlds

### Why Connection Selection?
- Multiple connections support
- In-memory databases work
- User explicitly chooses
- Matches R mental model

### Why File-Based R Communication?
- Silent (no console pollution)
- Efficient for large data
- Clean error handling
- Avoids stdout parsing

## Extension Points

### Official Extensions (Node.js)
- Load via: Command or `defaultExtensions` setting
- Available: Before connecting to R
- Examples: spatial, httpfs, json, parquet

### Community Extensions (R only)
```r
dbExecute(con, "INSTALL a5 FROM community; LOAD a5;")
# Functions automatically available via auto-refresh
```

## Known Limitations

- Community extensions: R-only (Node.js DuckDB limitations)
- Requires Positron IDE (uses Positron API)
- Auto-refresh: Requires `autoRefreshSchema: true` (default)

## Recent Major Changes

- **Jan 2026**: Hybrid function provider (Node.js + R merge)
- **Jan 2026**: Auto-refresh schema and functions
- **Jan 2026**: R connection selection UI (supports `:memory:`)
- **Jan 2026**: Themed SQL background colors
- **Jan 2026**: Community extension support via R
- **Jan 2026**: Silent R execution (no console pollution)
- **Jan 2026**: Function count notifications

## For Future Development

1. All R code must use silent execution mode
2. Use temp files for data transfer (not stdout)
3. Always cleanup temp files in finally/dispose
4. Debounce auto-refresh to prevent spam
5. Test with Air formatter multi-line patterns
6. Verify no console pollution on errors
