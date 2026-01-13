import * as vscode from 'vscode';

export interface SQLStringContext {
    query: string;
    range: vscode.Range;
    functionName: string;
    isMultiline: boolean;
}

/**
 * Detects SQL strings in R code, particularly in DBI function calls
 */
export class SQLStringDetector {
    private static readonly DBI_FUNCTIONS = [
        'dbExecute',
        'dbGetQuery',
        'dbSendQuery',
        'dbSendStatement',
        'DBI::dbExecute',
        'DBI::dbGetQuery',
        'DBI::dbSendQuery',
        'DBI::dbSendStatement',
        'dbplyr::sql',
        'sql'
    ];

    /**
     * Check if position is inside a SQL string
     */
    static isInsideSQLString(document: vscode.TextDocument, position: vscode.Position): SQLStringContext | null {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // Check if we're inside a string
        const stringRange = this.getStringRangeAtPosition(document, position);
        if (!stringRange) {
            return null;
        }

        // Check if this string is part of a DBI function call
        const functionContext = this.findDBIFunctionContext(document, stringRange.start);
        if (!functionContext) {
            return null;
        }

        const query = document.getText(stringRange);

        return {
            query: this.cleanSQLString(query),
            range: stringRange,
            functionName: functionContext,
            isMultiline: stringRange.start.line !== stringRange.end.line
        };
    }

    /**
     * Get the range of the string at the given position
     */
    private static getStringRangeAtPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        const charPos = position.character;

        // Find opening quote
        let openQuote = -1;
        let quoteChar = '';

        for (let i = charPos; i >= 0; i--) {
            const char = lineText[i];
            if (char === '"' || char === "'" || char === '`') {
                // Check if it's escaped
                if (i > 0 && lineText[i - 1] === '\\') {
                    continue;
                }
                openQuote = i;
                quoteChar = char;
                break;
            }
        }

        if (openQuote === -1) {
            return null;
        }

        // Find closing quote (could be on another line)
        let closeQuote = -1;
        let currentLine = position.line;
        let searchText = lineText.substring(openQuote + 1);

        while (currentLine < document.lineCount) {
            const searchLineText = currentLine === position.line ? searchText : document.lineAt(currentLine).text;

            for (let i = 0; i < searchLineText.length; i++) {
                const char = searchLineText[i];
                if (char === quoteChar) {
                    // Check if it's escaped
                    if (i > 0 && searchLineText[i - 1] === '\\') {
                        continue;
                    }
                    closeQuote = i;
                    break;
                }
            }

            if (closeQuote !== -1) {
                const startPos = new vscode.Position(position.line, openQuote + 1);
                const endPos = currentLine === position.line
                    ? new vscode.Position(currentLine, openQuote + 1 + closeQuote)
                    : new vscode.Position(currentLine, closeQuote);

                return new vscode.Range(startPos, endPos);
            }

            currentLine++;
        }

        return null;
    }

    /**
     * Find if the string is part of a DBI function call
     */
    private static findDBIFunctionContext(document: vscode.TextDocument, position: vscode.Position): string | null {
        // Look backwards from the string position to find function call
        let currentLine = position.line;
        let searchText = '';

        // Gather context (up to 5 lines back)
        for (let i = Math.max(0, currentLine - 5); i <= currentLine; i++) {
            searchText += document.lineAt(i).text + '\n';
        }

        // Check for DBI functions
        for (const funcName of this.DBI_FUNCTIONS) {
            const pattern = new RegExp(`${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'i');
            if (pattern.test(searchText)) {
                return funcName;
            }
        }

        return null;
    }

    /**
     * Clean SQL string (remove R string escapes, etc.)
     */
    private static cleanSQLString(sql: string): string {
        return sql
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .trim();
    }

    /**
     * Get the cursor position relative to the SQL string
     */
    static getSQLCursorPosition(document: vscode.TextDocument, position: vscode.Position, context: SQLStringContext): number {
        const stringStart = context.range.start;

        if (position.line === stringStart.line) {
            return position.character - stringStart.character;
        }

        // Multi-line calculation
        let offset = 0;
        for (let line = stringStart.line; line < position.line; line++) {
            offset += document.lineAt(line).text.length - (line === stringStart.line ? stringStart.character : 0) + 1; // +1 for newline
        }
        offset += position.character;

        return offset;
    }
}
