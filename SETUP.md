# Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

Note: This may take a few minutes as it compiles the DuckDB native module.

### 2. Compile TypeScript

```bash
npm run compile
```

### 3. Package Extension (Optional)

```bash
npm run package
```

This creates a `.vsix` file that you can install in VSCode or Positron.

## Development

### Watch Mode

For active development, use watch mode to automatically recompile on changes:

```bash
npm run watch
```

### Testing in VSCode

1. Open this folder in VSCode
2. Press F5 to launch Extension Development Host
3. Open an R file and try typing SQL in `dbGetQuery()` strings

### Testing in Positron

Same as VSCode - Positron uses the same extension system.

## Installation

### From VSIX

1. Build the extension: `npm run package`
2. In VSCode/Positron, open Extensions view
3. Click "..." menu → "Install from VSIX..."
4. Select the generated `.vsix` file

### From Source (Development)

1. Link the extension:
   ```bash
   ln -s $(pwd) ~/.vscode/extensions/duckdb-r-editor
   ```
2. Reload VSCode
3. The extension will be active for R files

## Configuration

Add to your VSCode/Positron settings:

```json
{
  "duckdb-r-editor.duckdbPath": "/path/to/your/database.duckdb",
  "duckdb-r-editor.enableAutoComplete": true,
  "duckdb-r-editor.enableDiagnostics": true
}
```

## Troubleshooting

### DuckDB Native Module Fails to Build

If the DuckDB npm package fails to install:

1. Make sure you have build tools:
   - **macOS**: `xcode-select --install`
   - **Linux**: `sudo apt-get install build-essential` (Debian/Ubuntu)
   - **Windows**: Install Visual Studio Build Tools

2. Try installing duckdb separately:
   ```bash
   npm install duckdb --build-from-source
   ```

### Extension Not Activating

Check the Output panel in VSCode (View → Output, select "R SQL Editor").

### No Autocomplete Appearing

1. Ensure you're inside a SQL string in an R file
2. Check that the function is recognized (e.g., `dbGetQuery()`, `dbExecute()`)
3. Connect to a database: Command Palette → "R SQL: Connect to DuckDB Database"

## Next Steps

Check out `examples/demo.R` for examples of all the features!
