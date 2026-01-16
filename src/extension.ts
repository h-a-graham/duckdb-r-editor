import * as vscode from 'vscode';
import { SQLCompletionProvider } from './completionProvider';
import { PositronSchemaProvider } from './positronSchemaProvider';
import { DuckDBFunctionProvider } from './functionProvider';
import { SQLDiagnosticsProvider } from './diagnosticsProvider';
import { DocumentCache } from './documentCache';
import { SQLSemanticTokenProvider } from './semanticTokenProvider';
import { tryAcquirePositronApi } from '@posit-dev/positron';

let schemaProvider: PositronSchemaProvider | undefined;
let functionProvider: DuckDBFunctionProvider | undefined;
let diagnosticsProvider: SQLDiagnosticsProvider;
let outputChannel: vscode.OutputChannel;
let documentCache: DocumentCache;
let semanticTokenProvider: SQLSemanticTokenProvider;

export async function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('DuckDB R Editor');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine('DuckDB R Editor - Positron Edition');
  outputChannel.appendLine('='.repeat(60));

  // Check for Positron API (REQUIRED)
  const positronApi = tryAcquirePositronApi();
  if (!positronApi) {
    const errorMsg = 'DuckDB R Editor requires Positron IDE. This extension will not work in VS Code.';
    outputChannel.appendLine('✗ ' + errorMsg);
    vscode.window.showErrorMessage(errorMsg);
    return;
  }

  outputChannel.appendLine('✓ Positron API detected');

  // Initialize function provider (Node.js DuckDB for function discovery)
  outputChannel.appendLine('Initializing function provider...');
  functionProvider = new DuckDBFunctionProvider();
  await functionProvider.refreshFunctions();
  const funcCount = functionProvider.getAllFunctions().length;
  outputChannel.appendLine(`✓ Discovered ${funcCount} DuckDB functions`);
  context.subscriptions.push(functionProvider);

  // Schema provider will be initialized when user connects to a database
  outputChannel.appendLine('');
  outputChannel.appendLine('Ready! Use "DuckDB R Editor: Connect to DuckDB Database" to get started.');
  outputChannel.appendLine('Note: You must have an active R DuckDB connection in your session.');
  outputChannel.appendLine('='.repeat(60));

  // Initialize diagnostics provider
  outputChannel.appendLine('Initializing diagnostics provider');
  diagnosticsProvider = new SQLDiagnosticsProvider();

  // Initialize document cache for performance and stability
  outputChannel.appendLine('Initializing document cache');
  documentCache = new DocumentCache();

  // Check if semantic highlighting is enabled (default: true)
  const config = vscode.workspace.getConfiguration('duckdb-r-editor');
  const useSemanticHighlighting = config.get<boolean>('useSemanticHighlighting', true);

  if (useSemanticHighlighting) {
    // Register semantic token provider for Air formatter support
    outputChannel.appendLine('Registering semantic token provider for SQL highlighting');
    outputChannel.appendLine('  Supports Air formatter multi-line strings');
    outputChannel.appendLine('  Only highlights SQL content - preserves R syntax highlighting');
    semanticTokenProvider = new SQLSemanticTokenProvider(documentCache);

    const semanticTokenProviderDisposable = vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'r', scheme: 'file' },
      semanticTokenProvider,
      SQLSemanticTokenProvider.getLegend()
    );
    context.subscriptions.push(semanticTokenProviderDisposable);
  } else {
    // Use TextMate grammar injection (fallback)
    outputChannel.appendLine('SQL syntax highlighting using TextMate grammar injection');
    outputChannel.appendLine('  Note: Limited support for Air formatter multi-line strings');
  }

  // Combined provider adapter for completion (schema + functions)
  const combinedProvider = {
    getTableNames: () => schemaProvider?.getTableNames() || [],
    getColumns: (tableName: string) => schemaProvider?.getColumns(tableName) || [],
    getAllColumns: () => schemaProvider?.getAllColumns() || [],
    getFunctionNames: () => functionProvider?.getFunctionNames() || [],
    getFunction: (name: string) => functionProvider?.getFunction(name),
    getAllFunctions: () => functionProvider?.getAllFunctions() || [],
    isConnected: () => schemaProvider?.isConnected() || false
  };

  // Register completion provider for R files
  outputChannel.appendLine('Registering completion provider for R files');
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'r', scheme: 'file' },
    new SQLCompletionProvider(combinedProvider as any),
    '.', // Trigger on dot for table.column
    '(', // Trigger on function call
    ' ', // Trigger on space
    '\n', // Trigger on newline
    '"', // Trigger on quote
    "'", // Trigger on single quote
    'S', 'E', 'F', 'W', 'J', 'O', 'I', // Common SQL keywords
    '*', ',', '=' // SQL operators
  );

  // Register commands
  outputChannel.appendLine('Registering commands: connectDatabase, refreshSchema, executeQuery');
  const connectCommand = vscode.commands.registerCommand(
    'duckdb-r-editor.connectDatabase',
    async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'DuckDB Database': ['db', 'duckdb', 'ddb']
        },
        title: 'Select DuckDB Database File'
      });

      if (uri && uri[0]) {
        await connectToDatabase(uri[0].fsPath);
      }
    }
  );

  const disconnectCommand = vscode.commands.registerCommand(
    'duckdb-r-editor.disconnectDatabase',
    async () => {
      if (!schemaProvider || !schemaProvider.isConnected()) {
        vscode.window.showInformationMessage('No active database connection');
        return;
      }

      // Disconnect by disposing the schema provider
      schemaProvider.dispose();
      schemaProvider = undefined;

      outputChannel.appendLine('✓ Disconnected from database');
      vscode.window.showInformationMessage('Disconnected from database');
    }
  );

  const refreshSchemaCommand = vscode.commands.registerCommand(
    'duckdb-r-editor.refreshSchema',
    refreshSchema
  );

  const loadExtensionCommand = vscode.commands.registerCommand(
    'duckdb-r-editor.loadExtension',
    async () => {
      if (!functionProvider) {
        vscode.window.showErrorMessage('Function provider not initialized');
        return;
      }

      const extensionName = await vscode.window.showInputBox({
        prompt: 'Enter DuckDB extension name (e.g., spatial, httpfs, json)',
        placeHolder: 'spatial',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Extension name is required';
          }
          return null;
        }
      });

      if (extensionName) {
        try {
          await functionProvider.loadExtension(extensionName.trim());
          const funcCount = functionProvider.getAllFunctions().length;
          vscode.window.showInformationMessage(
            `✓ Extension '${extensionName}' loaded! ${funcCount} functions now available for autocomplete.`
          );
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to load extension: ${err.message}`);
        }
      }
    }
  );


  // Register diagnostic provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'r', scheme: 'file' },
      diagnosticsProvider
    )
  );

  // Watch for document changes to update diagnostics and invalidate cache
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'r') {
        // Update diagnostics
        diagnosticsProvider.updateDiagnostics(event.document);

        // Invalidate document cache to force re-parse on next access
        documentCache.invalidateDocument(event.document);
      }
    })
  );

  // Clear cache when documents are closed to save memory
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      if (document.languageId === 'r') {
        documentCache.invalidateDocument(document);
      }
    })
  );

  // Add to subscriptions
  context.subscriptions.push(
    completionProvider,
    connectCommand,
    disconnectCommand,
    refreshSchemaCommand,
    loadExtensionCommand
  );

  outputChannel.appendLine('Extension activation complete!');
  outputChannel.appendLine('Commands available: "R SQL: Connect to DuckDB Database", "R SQL: Refresh Database Schema"');
}

/**
 * Connect to a database with consistent messaging
 * Creates a new Positron schema provider and queries R session
 */
async function connectToDatabase(dbPath: string): Promise<void> {
  const positronApi = tryAcquirePositronApi();
  if (!positronApi) {
    vscode.window.showErrorMessage('Positron API not available. This extension requires Positron IDE.');
    return;
  }

  try {
    // Create new schema provider for this connection
    schemaProvider = new PositronSchemaProvider(positronApi);
    await schemaProvider.connect(dbPath);

    const tableCount = schemaProvider.getTableNames().length;
    const funcCount = functionProvider?.getAllFunctions().length || 0;

    if (tableCount === 0) {
      vscode.window.showWarningMessage(
        `Connected to ${dbPath} but found 0 tables. Make sure you have an active R DuckDB connection with tables.`
      );
      outputChannel.appendLine(`⚠️  Connected but found 0 tables - check R session`);
    } else {
      vscode.window.showInformationMessage(
        `Connected to ${dbPath}\n${tableCount} tables from R session, ${funcCount} functions available`
      );
      outputChannel.appendLine(`✓ Connected: ${tableCount} tables (from R), ${funcCount} functions`);
    }

    // Debug: Log table and column details
    const tables = schemaProvider.getTableNames();
    for (const tableName of tables) {
      const columns = schemaProvider.getColumns(tableName);
      outputChannel.appendLine(`  Table: ${tableName} (${columns.length} columns)`);
      columns.forEach(col => {
        outputChannel.appendLine(`    - ${col.name}: ${col.type}`);
      });
    }
  } catch (err: any) {
    outputChannel.appendLine(`✗ Connection failed: ${err.message}`);
    vscode.window.showErrorMessage(`Failed to connect: ${err.message}`);
    throw err;
  }
}

/**
 * Refresh schema and functions with consistent messaging
 */
async function refreshSchema(): Promise<void> {
  if (!schemaProvider) {
    vscode.window.showWarningMessage('No active database connection. Connect to a database first.');
    return;
  }

  try {
    await schemaProvider.refreshSchema();
    const tableCount = schemaProvider.getTableNames().length;
    const funcCount = functionProvider?.getAllFunctions().length || 0;

    vscode.window.showInformationMessage(
      `Schema refreshed: ${tableCount} tables (from R session), ${funcCount} functions`
    );
    outputChannel.appendLine(`✓ Refreshed: ${tableCount} tables, ${funcCount} functions`);
  } catch (err: any) {
    outputChannel.appendLine(`✗ Refresh failed: ${err.message}`);
    vscode.window.showErrorMessage(`Failed to refresh schema: ${err.message}`);
    throw err;
  }
}

export function deactivate() {
  if (schemaProvider) {
    schemaProvider.dispose();
  }
  if (functionProvider) {
    functionProvider.dispose();
  }
}
