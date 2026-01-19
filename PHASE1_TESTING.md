# Phase 1 Testing Guide: File-Based Schema Storage

## Package Built ✅

**Location:** `duckdb-r-editor-0.4.0.vsix` (29.56 MB)
**Bundle size:** 49.2 KB (minified)

---

## Installation in Positron

### 1. Install Extension

```bash
# In Positron:
# 1. Open Extensions view (Cmd/Ctrl + Shift + X)
# 2. Click "..." menu → Install from VSIX
# 3. Select: duckdb-r-editor-0.4.0.vsix
# 4. Reload window when prompted
```

**OR** if previous version installed:
```bash
# Uninstall old version first, then install new .vsix
```

---

## Test Scenarios

### Test 1: Connect to Database & Verify File Creation

**Setup R connection:**
```r
library(DBI)
library(duckdb)

# Create in-memory connection
con <- dbConnect(duckdb(), ":memory:")

# Create test table
dbExecute(con, "CREATE TABLE customers (id INTEGER, name VARCHAR)")
dbExecute(con, "CREATE TABLE orders (order_id INTEGER, customer_id INTEGER)")
```

**Connect extension:**
1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Run: "DuckDB R Editor: Connect to DuckDB Database"
3. Select: "con"

**Expected console output:**
```r
✓ Schema updated
```

**NOT this (old behavior):**
```r
__JSON_START__
[{"table_name":"customers"...}]
__JSON_END__
```

**Verify schema file created:**
```bash
# On Linux/Mac:
ls -la ~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/

# Expected: schema-con-<timestamp>.json file exists
```

**Verify autocomplete works:**
- Type in R file: `dbGetQuery(con, "SELECT `
- Should show column suggestions: `id`, `name`, `order_id`, `customer_id`
- Type: `FROM `
- Should show table suggestions: `customers`, `orders`

---

### Test 2: Schema File Content

**Inspect schema file:**
```bash
# Find the schema file
cat ~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/schema-con-*.json
```

**Expected content:**
```json
[
  {
    "table_name": "customers",
    "column_name": "id",
    "data_type": "INTEGER",
    "is_nullable": "YES"
  },
  {
    "table_name": "customers",
    "column_name": "name",
    "data_type": "VARCHAR",
    "is_nullable": "YES"
  },
  {
    "table_name": "orders",
    "column_name": "order_id",
    "data_type": "INTEGER",
    "is_nullable": "YES"
  },
  {
    "table_name": "orders",
    "column_name": "customer_id",
    "data_type": "INTEGER",
    "is_nullable": "YES"
  }
]
```

---

### Test 3: Manual Schema Refresh

**Add new table in R:**
```r
dbExecute(con, "CREATE TABLE products (product_id INTEGER, price DECIMAL)")
```

**Refresh schema:**
1. Command Palette → "DuckDB R Editor: Refresh DuckDB Schema"

**Expected console output:**
```r
✓ Schema updated
```

**Verify:**
- Autocomplete now includes `products` table
- Schema file updated with new table
- Console output is clean (no JSON)

---

### Test 4: Empty Database Handling

**Create empty connection:**
```r
empty_con <- dbConnect(duckdb(), ":memory:")
# Don't create any tables
```

**Connect extension:**
1. Command Palette → Connect to Database
2. Select: "empty_con"

**Expected:**
- Warning dialog: "Database is empty - no tables found"
- Console shows: `⚠️ Schema updated: 0 tables`
- Schema file created with empty array: `[]`
- Function autocomplete still works (900+ functions)

---

### Test 5: Multiple Connections

**Create multiple connections:**
```r
con1 <- dbConnect(duckdb(), ":memory:")
dbExecute(con1, "CREATE TABLE users (id INTEGER)")

con2 <- dbConnect(duckdb(), ":memory:")
dbExecute(con2, "CREATE TABLE posts (post_id INTEGER)")
```

**Connect to con1:**
1. Connect to Database → Select "con1"
2. Verify: Autocomplete shows `users` table only
3. Verify: Schema file `schema-con1-*.json` exists

**Switch to con2:**
1. Connect to Database → Select "con2"
2. Verify: Autocomplete shows `posts` table only
3. Verify: Old `schema-con1-*.json` deleted
4. Verify: New `schema-con2-*.json` created

---

### Test 6: Disconnect Cleanup

**Disconnect:**
1. Command Palette → "DuckDB R Editor: Disconnect from Database"

**Verify:**
```bash
# Schema file should be deleted
ls ~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/
# Should be empty or file deleted
```

---

### Test 7: File-Based Database

**Create file-based connection:**
```r
file_con <- dbConnect(duckdb(), "test_phase1.duckdb")
dbExecute(file_con, "CREATE TABLE test (id INTEGER, value VARCHAR)")
```

**Connect extension:**
1. Connect → Select "file_con"

**Expected:**
- Same behavior as in-memory
- Clean console output
- Schema file created
- Autocomplete works

---

## Validation Checklist

### Console Output ✅
- [ ] No JSON output in console
- [ ] Only shows: `✓ Schema updated` on success
- [ ] Shows: `⚠️ Schema updated: 0 tables` for empty database
- [ ] Clean, minimal output

### Schema File Storage ✅
- [ ] File created on connect
- [ ] File location: `~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/`
- [ ] File naming: `schema-{connectionName}-{timestamp}.json`
- [ ] File content is valid JSON
- [ ] File deleted on disconnect
- [ ] Old files cleaned up on new connection

### Functionality ✅
- [ ] Autocomplete works (tables, columns, functions)
- [ ] Schema refresh updates file
- [ ] Empty databases handled gracefully
- [ ] Multiple connections work
- [ ] In-memory databases supported
- [ ] File-based databases supported

### Extension Logs ✅
Check Output panel (View → Output → "DuckDB R Editor"):
- [ ] Shows: `✓ Schema loaded: X tables`
- [ ] Shows: `Deleted old schema file: ...` (when switching connections)
- [ ] No errors or warnings

---

## Known Issues / Expected Behavior

### ✅ Normal Behavior
1. **First connect takes 1-2 seconds** - Creating file and querying schema
2. **File persists between window reloads** - Until disconnect or new connection
3. **Minimal R console output** - Only status messages, no JSON

### ⚠️ If Something's Wrong

**Autocomplete not working:**
```bash
# Check if schema file exists
ls ~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/

# Check extension output
# View → Output → Select "DuckDB R Editor"
```

**File not created:**
- Check extension has write permissions
- Check Output panel for errors
- Try reconnecting

**Old JSON output still showing:**
- Ensure you installed the correct .vsix
- Check version in Extensions view (should be 0.4.0)
- Reload window

---

## Success Criteria

Phase 1 is successful if:

✅ **Console is clean** - No JSON output, only `✓ Schema updated`
✅ **Schema stored in file** - File exists and contains correct JSON
✅ **Autocomplete works** - Tables, columns, functions all suggest correctly
✅ **File cleanup works** - Files deleted on disconnect, old files removed
✅ **All database types work** - In-memory, file-based, empty databases

---

## Debugging

### View Extension Logs
```
View → Output → Select "DuckDB R Editor" from dropdown
```

### Check Schema File
```bash
# Linux/Mac
cat ~/.vscode/extensions-data/globalStorage/*/duckdb-schemas/*.json | jq .

# Should show pretty-printed schema
```

### Verify Extension Version
```
Extensions view → Search "DuckDB" → Should show "0.4.0"
```

---

## Next Phase Preview

**Phase 2: Auto-Refresh (Not Yet Implemented)**
- Automatic schema updates when R code runs
- Debounced to max once per 5 seconds
- Triggered by Positron execution events
- Configurable on/off

Phase 1 focuses on **file-based storage only** - all refreshes are manual.

---

Last updated: 2024-01-17
Phase 1 Testing
