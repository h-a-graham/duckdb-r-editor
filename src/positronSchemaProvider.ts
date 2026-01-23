import * as vscode from 'vscode';
import { ColumnInfo } from './types';
import * as os from 'os';
import * as path from 'path';
import { validateConnectionName } from './utils/validation';
import { RCodeExecutor } from './utils/rCodeExecutor';
import { RCodeTemplates } from './utils/rCodeTemplates';

/**
 * Provides DuckDB schema by querying active R session via Positron API
 * Uses file-based storage with silent execution (no console pollution)
 */
export class PositronSchemaProvider implements vscode.Disposable {
    private schema: Map<string, ColumnInfo[]> = new Map();
    private connectionName: string | null = null;
    private dbPath: string | null = null;
    private positronApi: any;
    private schemaFilePath: string | null = null;
    private functionsFilePath: string | null = null;
    private rFunctions: any[] = [];

    constructor(positronApi: any) {
        if (!positronApi) {
            throw new Error('Positron API is required for PositronSchemaProvider');
        }
        this.positronApi = positronApi;
    }

    /**
     * Connect to a specific R DuckDB connection
     */
    async connect(connectionName: string, dbPath: string): Promise<void> {
        // SECURITY: Validate connection name to prevent code injection
        validateConnectionName(connectionName);

        this.connectionName = connectionName;
        this.dbPath = dbPath;

        // Create temp files for schema and functions
        const tmpDir = os.tmpdir();
        const timestamp = Date.now();
        // Use safe, validated connection name in file path
        const safeConnectionName = connectionName.replace(/[^a-zA-Z0-9._]/g, '_');
        this.schemaFilePath = path.join(tmpDir, `duckdb-schema-${safeConnectionName}-${timestamp}.json`);
        this.functionsFilePath = path.join(tmpDir, `duckdb-functions-${safeConnectionName}-${timestamp}.json`);

        // Immediately fetch schema and functions from R session
        await this.refreshSchema();
        await this.refreshFunctions();
    }

    /**
     * Query schema from active R DuckDB connection and write to file
     */
    async refreshSchema(): Promise<void> {
        if (!this.schemaFilePath) {
            throw new Error('No schema file path set. Call connect() first.');
        }

        if (!this.connectionName) {
            throw new Error('No connection name set. Call connect() first.');
        }

        const targetConnection = this.connectionName;
        // Normalize file path for R (forward slashes)
        const schemaFilePath = RCodeExecutor.toRPath(this.schemaFilePath);

        // Generate R code to refresh schema information
        const rCode = RCodeTemplates.refreshSchema(targetConnection, schemaFilePath);

        try {
            let errorOutput = '';

            await this.positronApi.runtime.executeCode(
                'r',
                rCode,
                false,
                false,
                'silent' as any,
                undefined,
                {
                    onError: (text: string) => { errorOutput += text; }
                }
            );

            if (errorOutput) {
                throw new Error(errorOutput);
            }

            // Read schema from file
            await this.readSchemaFromFile();
        } catch (error: any) {
            console.error('Failed to refresh schema:', error);
            throw new Error(`Failed to refresh schema: ${error.message}`);
        }
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
        } catch (error: any) {
            console.error('Failed to read schema file:', error);
            throw new Error(`Failed to read schema file: ${error.message}`);
        }
    }

    /**
     * Get table names
     */
    getTableNames(): string[] {
        return Array.from(this.schema.keys());
    }

    /**
     * Get columns for a table
     */
    getColumns(tableName: string): ColumnInfo[] {
        return this.schema.get(tableName) || [];
    }

    /**
     * Get all columns from all tables
     */
    getAllColumns(): Array<{ table: string; column: ColumnInfo }> {
        const result: Array<{ table: string; column: ColumnInfo }> = [];
        for (const [table, columns] of this.schema.entries()) {
            for (const column of columns) {
                result.push({ table, column });
            }
        }
        return result;
    }

    /**
     * Check if connected to a database
     */
    isConnected(): boolean {
        return this.dbPath !== null;
    }

    /**
     * Get current database path
     */
    getDatabasePath(): string | null {
        return this.dbPath;
    }

    /**
     * Get current connection name
     */
    getConnectionName(): string | null {
        return this.connectionName;
    }

    /**
     * Get functions from R connection
     */
    getRFunctions(): any[] {
        return this.rFunctions;
    }

    /**
     * Refresh functions from R DuckDB connection
     */
    async refreshFunctions(): Promise<void> {
        if (!this.functionsFilePath) {
            return;
        }

        if (!this.connectionName) {
            return;
        }

        const targetConnection = this.connectionName;
        const functionsFilePath = RCodeExecutor.toRPath(this.functionsFilePath);

        // Generate R code to refresh function information
        const rCode = RCodeTemplates.refreshFunctions(targetConnection, functionsFilePath);

        try {
            let errorOutput = '';

            await this.positronApi.runtime.executeCode(
                'r',
                rCode,
                false,
                false,
                'silent' as any,
                undefined,
                {
                    onError: (text: string) => { errorOutput += text; }
                }
            );

            if (errorOutput) {
                throw new Error(errorOutput);
            }

            // Read functions from file
            await this.readFunctionsFromFile();
        } catch (error: any) {
            console.error('Failed to refresh functions:', error);
            // Don't throw - functions are optional, schema is critical
        }
    }

    /**
     * Read functions from file
     */
    private async readFunctionsFromFile(): Promise<void> {
        if (!this.functionsFilePath) {
            throw new Error('No functions file path set');
        }

        try {
            const fileUri = vscode.Uri.file(this.functionsFilePath);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const jsonStr = new TextDecoder().decode(fileContent);
            this.rFunctions = JSON.parse(jsonStr);
        } catch (error: any) {
            console.error('Failed to read functions file:', error);
            this.rFunctions = [];
        }
    }

    dispose() {
        // Cleanup temp schema file
        if (this.schemaFilePath) {
            try {
                const fileUri = vscode.Uri.file(this.schemaFilePath);
                vscode.workspace.fs.delete(fileUri);
            } catch (error) {
                // Ignore cleanup errors
            }
            this.schemaFilePath = null;
        }

        // Cleanup temp functions file
        if (this.functionsFilePath) {
            try {
                const fileUri = vscode.Uri.file(this.functionsFilePath);
                vscode.workspace.fs.delete(fileUri);
            } catch (error) {
                // Ignore cleanup errors
            }
            this.functionsFilePath = null;
        }

        this.connectionName = null;
        this.dbPath = null;
        this.schema.clear();
        this.rFunctions = [];
    }
}
