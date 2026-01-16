import * as vscode from 'vscode';
import { ColumnInfo } from './types';

/**
 * Provides DuckDB schema by querying active R session via Positron API
 * This is the PRIMARY and ONLY method for schema discovery
 */
export class PositronSchemaProvider implements vscode.Disposable {
    private schema: Map<string, ColumnInfo[]> = new Map();
    private dbPath: string | null = null;
    private positronApi: any;

    constructor(positronApi: any) {
        if (!positronApi) {
            throw new Error('Positron API is required for PositronSchemaProvider');
        }
        this.positronApi = positronApi;
    }

    /**
     * Set the database path (for display purposes only)
     */
    async connect(dbPath: string): Promise<void> {
        this.dbPath = dbPath;
        console.log('Connected to DuckDB database:', dbPath);

        // Immediately fetch schema from R session
        await this.refreshSchema();
    }

    /**
     * Query schema from active R DuckDB connection
     */
    async refreshSchema(): Promise<void> {
        console.log('Querying schema from Positron R session...');

        // R code to get all DuckDB connections and their schemas
        const rCode = `
tryCatch({
    # Find all DuckDB connections in global environment
    all_objs <- ls(envir = .GlobalEnv)
    connections <- list()

    for (obj_name in all_objs) {
        obj <- get(obj_name, envir = .GlobalEnv)
        if (inherits(obj, "duckdb_connection")) {
            connections[[obj_name]] <- obj
        }
    }

    if (length(connections) == 0) {
        stop("No DuckDB connections found in R session")
    }

    # Use the first connection
    con <- connections[[1]]

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

    if (length(result) == 0) {
        stop("No columns found")
    }

    # Return as JSON
    json_output <- if (requireNamespace("jsonlite", quietly = TRUE)) {
        jsonlite::toJSON(result, auto_unbox = TRUE)
    } else {
        paste0("[", paste(sapply(result, function(r) {
            sprintf('{"table_name":"%s","column_name":"%s","data_type":"%s","is_nullable":"%s"}',
                r$table_name, r$column_name, r$data_type, r$is_nullable)
        }), collapse = ","), "]")
    }

    cat("__JSON_START__\\n")
    cat(json_output)
    cat("\\n__JSON_END__\\n")
    cat("✓ DuckDB R Editor: Schema retrieved from active R session\\n")
}, error = function(e) {
    stop(e$message)
})
        `.trim();

        try {
            // Execute R code through Positron using observer pattern to capture output
            let output = '';
            let errorOutput = '';

            await this.positronApi.runtime.executeCode(
                'r',           // Language ID
                rCode,         // Code to execute
                false,         // Don't focus console
                false,         // Allow incomplete code
                'transient',   // Transient mode - allows output capture without history
                undefined,     // Use default error behavior
                {
                    onOutput: (text: string) => {
                        output += text;
                    },
                    onError: (text: string) => {
                        errorOutput += text;
                    }
                }
            );

            console.log('R output received, length:', output.length);

            if (!output || output.trim().length === 0) {
                const errorMsg = errorOutput || 'No output from R execution';
                throw new Error(errorMsg);
            }

            // Extract JSON between __JSON_START__ and __JSON_END__ markers
            const jsonStartMarker = '__JSON_START__';
            const jsonEndMarker = '__JSON_END__';
            const startIndex = output.indexOf(jsonStartMarker);
            const endIndex = output.indexOf(jsonEndMarker);

            if (startIndex === -1 || endIndex === -1) {
                throw new Error(`Could not find JSON markers in R output`);
            }

            const jsonStr = output.substring(startIndex + jsonStartMarker.length, endIndex).trim();
            console.log('Extracted JSON, length:', jsonStr.length);

            // Parse the JSON result
            const schemaData = JSON.parse(jsonStr);
            console.log('Parsed schema data:', schemaData.length, 'columns');

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

            console.log(`✓ Discovered ${this.schema.size} tables from R session`);
        } catch (error: any) {
            console.error('Failed to query R session:', error);
            throw new Error(`Failed to query R session: ${error.message}`);
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

    dispose() {
        this.dbPath = null;
        this.schema.clear();
    }
}
