# Auto-Refresh Schema Implementation Plan

## Problem
Current auto-refresh constantly executes R code in user's console, causing pollution and annoyance.

## Solution
Use file-based schema storage + event-driven refresh triggered by R execution.

---

## Architecture

### Storage
```
VS Code Extension Storage (context.storageUri)
├── duckdb-schemas/
│   ├── schema-con-1234567890.json      # Current schema for "con" connection
│   └── schema-analytics_db-*.json      # Previous schemas (cleanup old files)
```

### Flow
```
1. User runs R code
   ↓
2. Positron execution event fires
   ↓
3. Extension checks: Is connection active? Has 5s passed since last refresh?
   ↓
4. If yes → Execute R code to write schema to file
   ↓
5. R writes JSON to file (no console output except success message)
   ↓
6. Extension reads file and updates schema map
   ↓
7. Autocomplete refreshes with new schema
```

---

## Implementation Details

### 1. File Storage Management

**Location:** `context.storageUri/duckdb-schemas/`

**File naming:**
- Pattern: `schema-{connectionName}-{timestamp}.json`
- Example: `schema-con-1705502400000.json`
- Timestamp allows cleanup of old files

**Lifecycle:**
```typescript
// On connect
async connect(connectionName: string, dbPath: string) {
  this.connectionName = connectionName;
  this.schemaFilePath = await this.createSchemaFile(connectionName);
  await this.refreshSchemaToFile();
}

// On disconnect
dispose() {
  this.cleanupSchemaFile();
}
```

---

### 2. Modified R Code

**Current approach (console output):**
```r
cat("__JSON_START__\n")
cat(json_output)
cat("\n__JSON_END__\n")
```

**New approach (file output):**
```r
# Accept file path as parameter
schema_file_path <- "${schemaFilePath}"

# Write JSON directly to file
if (requireNamespace("jsonlite", quietly = TRUE)) {
  jsonlite::write_json(result, schema_file_path, auto_unbox = TRUE, pretty = TRUE)
} else {
  writeLines(json_output, schema_file_path)
}

# Minimal console confirmation
cat("✓ Schema updated\n")
```

**Benefits:**
- No JSON in console (just success message)
- File is persistent and debuggable
- Can be read by other tools

---

### 3. Schema Provider Changes

**New fields:**
```typescript
private schemaFilePath: string | null = null;
private lastRefreshTime: number = 0;
private readonly REFRESH_DEBOUNCE_MS = 5000; // 5 seconds
```

**New methods:**

```typescript
/**
 * Create schema file path for this connection
 */
private async createSchemaFile(connectionName: string): Promise<string> {
  const storageUri = this.context.storageUri;
  const schemaDir = vscode.Uri.joinPath(storageUri, 'duckdb-schemas');

  // Ensure directory exists
  await vscode.workspace.fs.createDirectory(schemaDir);

  // Cleanup old schema files for this connection
  await this.cleanupOldSchemaFiles(schemaDir, connectionName);

  // Create new file path
  const timestamp = Date.now();
  const fileName = `schema-${connectionName}-${timestamp}.json`;
  const filePath = vscode.Uri.joinPath(schemaDir, fileName);

  return filePath.fsPath;
}

/**
 * Cleanup old schema files for a connection
 */
private async cleanupOldSchemaFiles(schemaDir: vscode.Uri, connectionName: string) {
  try {
    const files = await vscode.workspace.fs.readDirectory(schemaDir);
    for (const [fileName, fileType] of files) {
      if (fileType === vscode.FileType.File &&
          fileName.startsWith(`schema-${connectionName}-`)) {
        const fileUri = vscode.Uri.joinPath(schemaDir, fileName);
        await vscode.workspace.fs.delete(fileUri);
      }
    }
  } catch (error) {
    // Directory might not exist yet, ignore
  }
}

/**
 * Refresh schema by writing to file and reading back
 */
async refreshSchemaToFile(): Promise<void> {
  if (!this.schemaFilePath) {
    throw new Error('No schema file path set');
  }

  // Generate R code with file path
  const rCode = `
tryCatch({
    # Get the specific connection object
    if (!exists("${this.connectionName}", envir = .GlobalEnv)) {
        stop("Connection '${this.connectionName}' not found in R session")
    }

    con <- get("${this.connectionName}", envir = .GlobalEnv)

    if (!inherits(con, "duckdb_connection")) {
        stop("Object '${this.connectionName}' is not a DuckDB connection")
    }

    # Get schema information
    if (!requireNamespace("DBI", quietly = TRUE)) {
        stop("DBI package not available")
    }

    tables <- DBI::dbListTables(con)
    result <- list()

    for (table in tables) {
        tryCatch({
            col_info <- DBI::dbGetQuery(con, sprintf(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '%s' AND table_schema = 'main' ORDER BY ordinal_position",
                table
            ))

            for (i in 1:nrow(col_info)) {
                result[[length(result) + 1]] <- list(
                    table_name = table,
                    column_name = col_info$column_name[i],
                    data_type = col_info$data_type[i],
                    is_nullable = col_info$is_nullable[i]
                )
            }
        }, error = function(e) {
            # Silently skip tables that can't be queried
        })
    }

    # Write to file
    schema_file_path <- "${this.schemaFilePath.replace(/\\/g, '/')}"

    if (requireNamespace("jsonlite", quietly = TRUE)) {
        jsonlite::write_json(result, schema_file_path, auto_unbox = TRUE, pretty = TRUE)
    } else {
        json_output <- paste0("[", paste(sapply(result, function(r) {
            sprintf('{"table_name":"%s","column_name":"%s","data_type":"%s","is_nullable":"%s"}',
                r$table_name, r$column_name, r$data_type, r$is_nullable)
        }), collapse = ","), "]")
        writeLines(json_output, schema_file_path)
    }

    cat("✓ Schema updated\\n")
}, error = function(e) {
    stop(e$message)
})
  `.trim();

  // Execute R code
  await this.positronApi.runtime.executeCode('r', rCode, false, false, 'transient' as any, undefined, {
    onOutput: (text: string) => { /* Minimal output */ },
    onError: (text: string) => { throw new Error(text); }
  });

  // Read schema from file
  await this.readSchemaFromFile();

  // Update last refresh time
  this.lastRefreshTime = Date.now();
}

/**
 * Read schema from file and update schema map
 */
private async readSchemaFromFile(): Promise<void> {
  if (!this.schemaFilePath) {
    throw new Error('No schema file path set');
  }

  try {
    const fileUri = vscode.Uri.file(this.schemaFilePath);
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const jsonStr = new TextDecoder().decode(fileContent);
    const schemaData = JSON.parse(jsonStr);

    // Update schema map
    this.schema.clear();
    for (const row of schemaData) {
      const tableName = row.table_name;
      if (!this.schema.has(tableName)) {
        this.schema.set(tableName, []);
      }

      this.schema.get(tableName)!.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES'
      });
    }

    console.log(`✓ Schema loaded from file: ${this.schema.size} tables`);
  } catch (error: any) {
    console.error('Failed to read schema file:', error);
    throw new Error(`Failed to read schema file: ${error.message}`);
  }
}

/**
 * Check if refresh is needed (debounce)
 */
canRefresh(): boolean {
  const now = Date.now();
  return (now - this.lastRefreshTime) >= this.REFRESH_DEBOUNCE_MS;
}

/**
 * Cleanup schema file on disconnect
 */
private cleanupSchemaFile(): void {
  if (this.schemaFilePath) {
    try {
      const fileUri = vscode.Uri.file(this.schemaFilePath);
      vscode.workspace.fs.delete(fileUri);
    } catch (error) {
      // Ignore cleanup errors
    }
    this.schemaFilePath = null;
  }
}
```

---

### 4. Auto-Refresh Hook (Extension.ts)

**Hook into Positron execution events:**

```typescript
// In activate()
if (config.get<boolean>('autoRefreshSchema', false)) {
  setupAutoRefresh(context, positronApi);
}

/**
 * Setup auto-refresh on R code execution
 */
function setupAutoRefresh(context: vscode.ExtensionContext, positronApi: any) {
  // Listen to runtime execution events
  // This is a simplified example - actual API may differ
  const disposable = positronApi.runtime.onDidExecuteCode((event: any) => {
    // Only refresh if:
    // 1. Language is R
    // 2. Connection is active
    // 3. Enough time has passed since last refresh

    if (event.languageId !== 'r') {
      return;
    }

    if (!schemaProvider || !schemaProvider.isConnected()) {
      return;
    }

    if (!schemaProvider.canRefresh()) {
      return; // Too soon since last refresh
    }

    // Refresh schema in background (don't block)
    schemaProvider.refreshSchemaToFile().catch(error => {
      console.error('Auto-refresh failed:', error);
      // Don't show error to user - this is background operation
    });
  });

  context.subscriptions.push(disposable);
}
```

**Alternative: Use debouncing utility**

```typescript
import debounce from 'lodash.debounce'; // or custom implementation

const debouncedRefresh = debounce(
  async () => {
    if (schemaProvider && schemaProvider.isConnected()) {
      await schemaProvider.refreshSchemaToFile();
    }
  },
  5000, // 5 second debounce
  { leading: false, trailing: true }
);

positronApi.runtime.onDidExecuteCode((event: any) => {
  if (event.languageId === 'r') {
    debouncedRefresh();
  }
});
```

---

### 5. Configuration

**Add to package.json:**

```json
{
  "duckdb-r-editor.autoRefreshSchema": {
    "type": "boolean",
    "default": false,
    "description": "Automatically refresh schema when R code is executed (max once per 5 seconds)"
  },
  "duckdb-r-editor.autoRefreshDebounce": {
    "type": "number",
    "default": 5000,
    "description": "Minimum milliseconds between automatic schema refreshes"
  }
}
```

**Usage:**

```json
{
  "duckdb-r-editor.autoRefreshSchema": true,
  "duckdb-r-editor.autoRefreshDebounce": 5000
}
```

---

## Benefits

### 1. Clean Console ✅
```r
> dbExecute(con, "CREATE TABLE test (id INT)")
✓ Schema updated
# Instead of pages of JSON
```

### 2. Efficient ✅
- Only refreshes when R code runs
- Debounced to max once per 5 seconds
- DuckDB locking ensures schema only changes in active session

### 3. Debuggable ✅
```bash
# Can inspect schema file directly
cat ~/.vscode/extensions-data/storage/duckdb-schemas/schema-con-*.json
```

### 4. Persistent ✅
- Schema file survives across window reloads (within session)
- Can be used by other tools if needed

### 5. Configurable ✅
- Users can enable/disable
- Adjustable debounce interval

---

## Migration Path

### Phase 1: File-Based Schema (No Auto-Refresh)
1. Implement file storage and reading
2. Update `refreshSchema()` to use files
3. Keep manual refresh command
4. Test thoroughly

### Phase 2: Add Auto-Refresh Hook
1. Add Positron execution event listener
2. Add debouncing
3. Add configuration options
4. Make opt-in (default: false)

### Phase 3: Polish
1. Add user notifications for first auto-refresh
2. Add status bar indicator
3. Add command to view schema file
4. Documentation

---

## Edge Cases

### 1. File Permissions
- Use VS Code managed storage (handles permissions)
- Fallback to temp directory if storage unavailable

### 2. Multiple Connections
- Each connection gets own schema file
- Cleanup old files on new connection

### 3. Extension Restart
- Schema files persist in storage
- Can optionally reload from file on reconnect

### 4. R Session Restart
- Detect session restart
- Clear schema and file
- Show reconnect prompt

### 5. Large Schemas
- File I/O is fast enough for reasonable schemas (<1000 tables)
- Consider compression for very large schemas

---

## Testing Checklist

- [ ] Schema file created on connection
- [ ] Schema file updated on manual refresh
- [ ] Schema file updated on auto-refresh (if enabled)
- [ ] Old schema files cleaned up
- [ ] File deleted on disconnect
- [ ] Debouncing works (max 1 refresh per 5s)
- [ ] No console pollution
- [ ] Works with in-memory databases
- [ ] Works with file-based databases
- [ ] Works with multiple connections
- [ ] Handles R session restart
- [ ] Handles extension restart
- [ ] Configuration options work
- [ ] Manual refresh still works

---

## Success Criteria

✅ No console output except "✓ Schema updated"
✅ Schema stays in sync with R session
✅ Max 1 refresh per 5 seconds
✅ File-based storage is reliable
✅ Backward compatible (manual refresh works)
✅ Configurable (can disable auto-refresh)
✅ Clean user experience

---

Last updated: 2024-01-17
