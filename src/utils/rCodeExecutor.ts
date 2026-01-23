import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Utility for executing R code and handling file operations
 */
export class RCodeExecutor {
    /**
     * Create a temporary file path with cleanup
     * @param prefix File prefix (e.g., 'duckdb-schema')
     * @returns Temp file path
     */
    static createTempFilePath(prefix: string): string {
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        return path.join(tempDir, `${prefix}-${timestamp}-${random}.json`);
    }

    /**
     * Clean up temp file if it exists
     * @param filePath Path to temp file
     */
    static cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Convert file path to R-compatible format (forward slashes)
     * @param filePath File path to convert
     * @returns R-compatible path
     */
    static toRPath(filePath: string): string {
        return filePath.replace(/\\/g, '/');
    }
}
