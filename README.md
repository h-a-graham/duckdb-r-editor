# DuckDB R Editor (Positron Edition)

> [!WARNING]
> This is a beta version of the DuckDB R Editor extension. It has also been **mostly** generated using Claude Code. Please use with caution and report any issues.

> [!NOTE]
> **Positron IDE Only**: This extension requires Positron and will not work in VS Code. It queries your active R DuckDB connection directly via the Positron API.

**SQL syntax highlighting and intelligent autocomplete for DuckDB in R files.** Queries your active R session for schema - no file locking issues!

Write DuckDB SQL with full IDE support - syntax highlighting, autocomplete, and schema introspection - right inside R strings.

---

## ✨ What Makes This Different

**Traditional approach:** Extension opens database file → File locking conflicts with R session → Frustration

**This extension:** Queries your active R DuckDB connection via Positron API → No file access → No conflicts!

### Key Benefits

✅ **No file locking issues** - Queries R session directly, not the database file
✅ **Always in sync** - Gets schema from YOUR actual R connection
✅ **Zero external dependencies** - No DuckDB CLI installation needed
✅ **900+ DuckDB functions** - Complete function catalog with signatures
✅ **Works with active connections** - Use while your R session has the database open
✅ **Clean R console** - Minimal output with helpful status messages

---

## Installation

### 1. Prerequisites

**Required:**
- [Positron IDE](https://github.com/posit-dev/positron) (not VS Code)
- R with `DBI` and `duckdb` packages
- Node.js 16+ (for building the extension)

**Optional:**
- [Air formatter](https://posit-dev.github.io/air/editor-vscode.html) - For clean multi-line SQL formatting

```r
# Install R packages
install.packages(c("DBI", "duckdb"))
```

### 2. Build and Install Extension

```bash
# Clone and build
git clone https://github.com/h-a-graham/duckdb-r-editor.git
cd duckdb-r-editor
npm install
npm run package

# Install the .vsix file in Positron:
# Extensions → ... menu → Install from VSIX
```

---

## Why Use This Extension?

<table>
<tr>
<td width="50%">

### Before: No SQL Support in R Strings
<img src="images/syntax-highlight-before.png" alt="Before - No SQL highlighting" width="100%">

</td>
<td width="50%">

### After: Full SQL IDE Features
<img src="images/syntax-highlight-after.png" alt="After - Full SQL highlighting" width="100%">

</td>
</tr>
</table>

**What you get:**
- 🔵 **SQL keywords** - SELECT, FROM, WHERE, JOIN, etc.
- 🟡 **Functions** - SUM(), COUNT(), DATE_TRUNC(), 900+ DuckDB functions
- 🔷 **Table names** - From your active R connection
- 📋 **Column names** - Live from your R session
- 🟠 **Literals** - Strings, numbers, dates

✅ Autocomplete for tables, columns, and 900+ DuckDB functions

✅ Context-aware colors for different SQL elements

✅ Works with Air formatter multi-line strings

✅ No file locking conflicts with R sessions

---

## Quick Start

### 1. Create a DuckDB Connection in R

```r
library(DBI)
library(duckdb)

# Create your connection as usual
con <- dbConnect(duckdb(), "sales.duckdb")

# Create some tables
dbExecute(con, "
  CREATE TABLE orders (
    order_id INTEGER,
    customer_id INTEGER,
    amount DECIMAL,
    order_date DATE
  )
")
```

**Keep your R connection open!** The extension will query it directly.

### 2. Connect the Extension

Use the Command Palette to connect:
- Open Command Palette (`Cmd/Ctrl + Shift + P`)
- Run: **"DuckDB R Editor: Connect to DuckDB Database"**
- Select your `.duckdb` file
- Extension queries your R session for schema

**What happens:**
1. Extension finds your active R DuckDB connection
2. Queries it for all tables and columns
3. Displays: `✓ DuckDB R Editor: Schema retrieved from active R session`
4. Autocomplete is ready!

### 3. Start Writing SQL with Autocomplete

SQL autocomplete works automatically in these functions:
```r
dbGetQuery()
dbExecute()
dbSendQuery()
dbSendStatement()
sql()              # dbplyr
glue_sql()         # glue package
```

### 4. Example: Full Autocomplete in Action

```r
# Your R connection is still open - no conflicts!
result <- dbGetQuery(con, "
  SELECT
    customer_id,                                      # ← Column (from R session)
    DATE_TRUNC('month', order_date) AS month,        # ← Function (with signature)
    SUM(amount) AS total                             # ← Aggregate function
  FROM orders                                         # ← Table (from R session)
  WHERE order_date > CURRENT_DATE - INTERVAL '30 days'
  GROUP BY customer_id, month
  ORDER BY total DESC
")
```

**As you type, you get:**
- Table names from your active R connection
- Column names for each table
- 900+ DuckDB functions with signatures
- Context-aware suggestions (tables after FROM, columns after SELECT)

🔵 **Keywords** | 🟡 **Functions** | 🔷 **Tables** | 📋 **Columns** | 🟠 **Strings**

---

## How It Works

### Architecture

**Schema (Tables & Columns):**
- Queries your active R DuckDB connection via Positron API
- Runs: `DBI::dbListTables()` and `DBI::dbGetQuery()` in your R session
- Gets live, accurate schema from YOUR connection
- No file access = No locking conflicts!

**Functions (900+ DuckDB Functions):**
- Uses Node.js DuckDB bindings (built-in, no install needed)
- Queries in-memory database: `SELECT * FROM duckdb_functions()`
- Discovers all built-in + extension functions
- Load extensions to get their functions

**Result:**
- R session provides YOUR data schema
- Node.js provides DuckDB function catalog
- Perfect separation of concerns!

---

## Key Features

### 🎨 Context-Aware Syntax Highlighting
- **Keywords**: `SELECT`, `FROM`, `WHERE`, `INSTALL`, `LOAD`, `DESCRIBE`
- **Functions**: `COUNT()`, `SUM()`, `DATE_TRUNC()` (distinct color)
- **Tables**: After `FROM`, `JOIN` (distinct color)
- **Columns**: Everywhere else (distinct color)
- **Works with Air formatter** - Multi-line strings on separate lines fully supported

### 🧠 Intelligent Autocomplete
- **900+ DuckDB functions** with signatures and examples
- **Live schema**: Tables and columns from your R session
- **Smart context**: Only suggests tables after `FROM`, columns after `SELECT`
- **Dot notation**: Type `table.` for column suggestions

### 🦆 DuckDB-Specific Support
All DuckDB commands highlighted and autocompleted:
```r
dbExecute(con, "INSTALL spatial")        # Extension management
dbExecute(con, "LOAD spatial")           # Load for autocomplete support
dbExecute(con, "ATTACH 'other.db'")      # Database operations
dbGetQuery(con, "DESCRIBE customers")    # Metadata commands
dbGetQuery(con, "SHOW TABLES")
dbGetQuery(con, "SUMMARIZE orders")      # Quick data summary
```

### 🔧 Glue Package Integration
```r
library(glue)

table <- "orders"
min_amount <- 100

result <- dbGetQuery(con, glue_sql("
  SELECT *
  FROM {`table`}              -- R interpolation
  WHERE amount > {min_amount}
  ORDER BY order_date DESC    -- Full SQL autocomplete!
", .con = con))
```

### ✈️ Air Formatter Support
Works perfectly with Air formatter's multi-line style:
```r
# Air formatter style - string on separate line
result <- dbGetQuery(
  con,
  "
  SELECT
    customer_id,
    name
  FROM customers
  WHERE active = TRUE
  "
)
# ✅ Full syntax highlighting and autocomplete!
```

### 🔌 Loading DuckDB Extensions

DuckDB extensions add specialized functions (spatial, JSON, HTTP, etc.). Load them to get autocomplete for their functions:

**Using Command Palette:**
1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Run: **"DuckDB R Editor: Load DuckDB Extension"**
3. Enter extension name (e.g., `spatial`, `httpfs`, `json`)
4. Extension functions now appear in autocomplete!

**Using SQL (in R):**
```r
# Install and load in your R code
dbExecute(con, "INSTALL spatial")
dbExecute(con, "LOAD spatial")

# Extension is now loaded in YOUR R session
# Autocomplete includes spatial functions
result <- dbGetQuery(con, "
  SELECT
    ST_Distance(point1, point2) as distance
  FROM locations
")
```

**Popular extensions:**
- `spatial` - GIS and geometry functions
- `httpfs` - Read files from HTTP/S3
- `json` - Advanced JSON functions
- `parquet` - Parquet file support
- `postgres_scanner` - Query PostgreSQL databases

---

## Configuration

Optional settings you can add to `.vscode/settings.json` in your project:

```json
{
  // Enable advanced SQL highlighting (default: true, recommended)
  "duckdb-r-editor.useSemanticHighlighting": true,

  // Enable autocomplete (default: true)
  "duckdb-r-editor.enableAutoComplete": true,

  // Enable SQL validation (default: true)
  "duckdb-r-editor.enableDiagnostics": true
}
```

---

## Commands

| Command | Description |
|---------|-------------|
| **Connect to DuckDB Database** | Connect to your database (queries R session for schema) |
| **Disconnect from Database** | Close connection |
| **Refresh DuckDB Schema** | Re-query R session for updated schema |
| **Load DuckDB Extension** | Load extensions for autocomplete (e.g., `spatial`, `httpfs`) |

Access via Command Palette (`Cmd/Ctrl + Shift + P`)

---

## Important Notes

### Works with In-Memory Databases!

```r
# ✅ Works perfectly - queries R session
con <- dbConnect(duckdb::duckdb(), dbdir = ":memory:")

# ✅ Also works - queries R session
con <- dbConnect(duckdb::duckdb(), dbdir = "mydata.duckdb")

# ✅ Even temporary files work
con <- dbConnect(duckdb::duckdb(), dbdir = tempfile(fileext = ".duckdb"))
```

**Why?** The extension queries your R session, not the file directly. As long as you have an R DuckDB connection, it works!

### R Console Output

When connecting, you'll see this in your R console:

```r
> tryCatch({
+   # Schema query code...
+ })
__JSON_START__
[...schema data...]
__JSON_END__
✓ DuckDB R Editor: Schema retrieved from active R session
```

This is **intentional and expected** - the extension is querying your R session. The final message confirms success.

### No File Locking Issues!

**The Problem (Solved):**
Traditional extensions open the database file → DuckDB file locking → Conflicts with your R session

**Our Solution:**
This extension queries your R session via Positron API → No file access → No conflicts!

**You can:**
- Keep your R connection open while using autocomplete ✅
- Write to the database in R while extension is connected ✅
- No need to disconnect/reconnect constantly ✅

### Semantic Highlighting (Default, Recommended)
The extension uses an optimized semantic token provider for:
- Context-aware colors (tables vs columns vs functions)
- Air formatter multi-line string support
- Proper handling of commented code

Performance: ~1-3ms overhead (negligible). To disable:
```json
{
  "duckdb-r-editor.useSemanticHighlighting": false
}
```

---

## Workflow Tips

### Typical Workflow

1. **Start R session** in Positron
2. **Create DuckDB connection** in R:
   ```r
   con <- dbConnect(duckdb(), "mydata.duckdb")
   ```
3. **Connect extension** via Command Palette
4. **Write SQL** with full autocomplete
5. **Keep working** - no need to disconnect!

### Best Practices

1. **Connect extension AFTER creating R connection** - The extension needs an active R connection to query
2. **Use file-based databases for persistence** - But in-memory works too!
3. **Load extensions in R** - Use `dbExecute(con, "LOAD spatial")` in your R code
4. **Refresh schema after DDL changes** - Use "Refresh DuckDB Schema" command if you create new tables
5. **Use `glue_sql()`** instead of `glue()` for safer SQL interpolation

### Troubleshooting

**"No DuckDB connections found in R session"**
- Make sure you have an active R DuckDB connection
- Connection must be a `duckdb_connection` object
- Connection must be in your global environment

**"0 tables found"**
- Your database might be empty (that's okay!)
- Check: `DBI::dbListTables(con)` in R console
- Extension shows what your R session sees

**Extension not working**
- Requires Positron IDE (not VS Code)
- Check Output panel: "DuckDB R Editor" for logs
- Make sure R session is active

---

## Future Improvements

### Possible Enhancements

- Support for multiple R DuckDB connections (currently uses first found)
- Background schema refresh (auto-detect new tables)
- Query result preview in hover tooltips
- Integration with Positron's Connections Pane

---

## License

MIT

## Acknowledgments

Built for the DuckDB and R communities. Thanks to:
- **DuckDB** - The amazing analytical database
- **Positron** - Excellent data science IDE with powerful extension API
- **Air formatter** - Clean R code formatting
- R packages: `DBI`, `duckdb`, `dbplyr`, `glue`
- **Claude Code** - For helping generate most of this extension!

---

## Contributing

Found a bug? Have a feature request?

[Open an issue on GitHub](https://github.com/h-a-graham/duckdb-r-editor/issues)
