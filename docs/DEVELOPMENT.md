# Development Guide

## Building

The project includes a Makefile for convenient development:

```bash
make              # Full build: compile → lint → package
make build        # Compile and lint (no package)
make quick        # Quick iteration (compile + package, skip lint)
make compile      # Just compile TypeScript
make lint         # Just run ESLint
make clean        # Remove build artifacts
make rebuild      # Clean rebuild from scratch
make help         # Show all commands
```

Without Make, use npm scripts directly:
```bash
npm run compile       # Compile TypeScript
npm run lint          # Run ESLint
npm run vsce:package  # Create .vsix package
```

## Project Structure

```
src/
├── extension.ts              # Main entry point
├── diagnosticsProvider.ts    # SQL validation
├── completionProvider.ts     # Autocomplete
├── semanticTokenProvider.ts  # Syntax highlighting
├── sqlBackgroundDecorator.ts # Background colors
├── positronSchemaProvider.ts # R session schema queries
├── functionProvider.ts       # DuckDB function discovery
├── constants.ts              # Extension constants
├── types.ts                  # TypeScript interfaces
└── utils/
    ├── rCodeTemplates.ts     # R code generation
    ├── validation.ts         # Input validation
    ├── errorHandler.ts       # Error utilities
    └── rCodeExecutor.ts      # R execution helpers
```

## Development Workflow

1. **Setup**
   ```bash
   git clone https://github.com/belian-earth/duckdb-r-editor.git
   cd duckdb-r-editor
   npm install
   ```

2. **Make Changes**
   - Edit TypeScript files in `src/`
   - Run `make compile` or `npm run compile` to build
   - Run `make lint` or `npm run lint` to check code quality

3. **Test Locally**
   - Launch Extension Development Host
   - Or package and install: `make quick` then install the `.vsix`

4. **Before Committing**
   ```bash
   make build    # Ensures code compiles and passes linting
   ```

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules (enforced in CI)
- Add JSDoc comments for public APIs
- Use const assertions for constant objects
- Prefer utility functions over duplicated code

## CI/CD

The project uses GitHub Actions for:
- Linting (ESLint)
- Type checking (TypeScript)
- Building

All checks must pass before merging PRs.
