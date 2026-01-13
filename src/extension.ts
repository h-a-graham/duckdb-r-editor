import * as vscode from 'vscode';
import { SQLCompletionProvider } from './completionProvider';
import { DuckDBConnectionManager } from './duckdbConnection';
import { SQLDiagnosticsProvider } from './diagnosticsProvider';

let connectionManager: DuckDBConnectionManager;
let diagnosticsProvider: SQLDiagnosticsProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('R SQL Editor extension is now active');

    // Initialize connection manager
    connectionManager = new DuckDBConnectionManager();

    // Initialize diagnostics provider
    diagnosticsProvider = new SQLDiagnosticsProvider();

    // Register completion provider for R files
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'r', scheme: 'file' },
        new SQLCompletionProvider(connectionManager),
        '.', // Trigger on dot for table.column
        '(', // Trigger on function call
        ' ', // Trigger on space
        '\n' // Trigger on newline
    );

    // Register commands
    const connectCommand = vscode.commands.registerCommand(
        'rsqledit.connectDatabase',
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
                await connectionManager.connect(uri[0].fsPath);
                vscode.window.showInformationMessage(`Connected to ${uri[0].fsPath}`);
            }
        }
    );

    const refreshSchemaCommand = vscode.commands.registerCommand(
        'rsqledit.refreshSchema',
        async () => {
            await connectionManager.refreshSchema();
            vscode.window.showInformationMessage('Schema refreshed');
        }
    );

    const executeQueryCommand = vscode.commands.registerCommand(
        'rsqledit.executeQuery',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const query = await extractQueryAtCursor(editor);
            if (query) {
                await executeAndShowResults(query);
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

    // Watch for document changes to update diagnostics
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'r') {
                diagnosticsProvider.updateDiagnostics(event.document);
            }
        })
    );

    context.subscriptions.push(
        completionProvider,
        connectCommand,
        refreshSchemaCommand,
        executeQueryCommand,
        connectionManager
    );

    // Try to auto-connect if path is configured
    const config = vscode.workspace.getConfiguration('rsqledit');
    const dbPath = config.get<string>('duckdbPath');
    if (dbPath) {
        connectionManager.connect(dbPath).catch(err => {
            console.error('Failed to auto-connect:', err);
        });
    }
}

async function extractQueryAtCursor(editor: vscode.TextEditor): Promise<string | null> {
    const position = editor.selection.active;
    const document = editor.document;
    const line = document.lineAt(position.line);

    // Find the SQL string at cursor
    const text = line.text;
    const match = text.match(/["']([^"']+)["']/);

    if (match) {
        return match[1];
    }

    return null;
}

async function executeAndShowResults(query: string) {
    if (!connectionManager.isConnected()) {
        vscode.window.showWarningMessage('No database connection. Use "R SQL: Connect to DuckDB Database" first.');
        return;
    }

    try {
        const results = await connectionManager.executeQuery(query);
        const panel = vscode.window.createWebviewPanel(
            'sqlResults',
            'SQL Results',
            vscode.ViewColumn.Beside,
            {}
        );

        panel.webview.html = formatResultsAsHTML(results);
    } catch (error) {
        vscode.window.showErrorMessage(`Query failed: ${error}`);
    }
}

function formatResultsAsHTML(results: any[]): string {
    if (!results || results.length === 0) {
        return '<html><body><p>No results</p></body></html>';
    }

    const columns = Object.keys(results[0]);
    let html = '<html><head><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #4CAF50; color: white; }</style></head><body>';
    html += '<table><thead><tr>';

    for (const col of columns) {
        html += `<th>${col}</th>`;
    }

    html += '</tr></thead><tbody>';

    for (const row of results) {
        html += '<tr>';
        for (const col of columns) {
            html += `<td>${row[col]}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table></body></html>';
    return html;
}

export function deactivate() {
    if (connectionManager) {
        connectionManager.dispose();
    }
}
