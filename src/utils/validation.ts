/**
 * Validation utilities for R and SQL identifiers
 */

/**
 * Validates a DuckDB extension name
 * Extension names must start with a letter and contain only letters, numbers, and underscores
 * @param name The extension name to validate
 * @returns true if valid, false otherwise
 */
export function isValidExtensionName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Validates an R connection name
 * Connection names must start with a letter and contain only letters, numbers, dots, and underscores
 * @param name The connection name to validate
 * @returns true if valid, false otherwise
 */
export function isValidConnectionName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9._]*$/.test(name);
}

/**
 * Validates a general R identifier
 * R identifiers can start with a letter or dot (but not dot followed by number)
 * @param name The identifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidRIdentifier(name: string): boolean {
    return /^([a-zA-Z]|\.[a-zA-Z_])[a-zA-Z0-9._]*$/.test(name);
}

/**
 * Validates and throws an error if extension name is invalid
 * @param extensionName The extension name to validate
 * @throws Error if the extension name is invalid
 */
export function validateExtensionName(extensionName: string): void {
    if (!isValidExtensionName(extensionName)) {
        throw new Error(
            `Invalid extension name: "${extensionName}". ` +
            `Extension names must start with a letter and contain only letters, numbers, and underscores.`
        );
    }
}

/**
 * Validates and throws an error if connection name is invalid
 * @param connectionName The connection name to validate
 * @throws Error if the connection name is invalid
 */
export function validateConnectionName(connectionName: string): void {
    if (!isValidConnectionName(connectionName)) {
        throw new Error(
            `Invalid connection name: "${connectionName}". ` +
            `R connection names must start with a letter and contain only letters, numbers, dots, and underscores.`
        );
    }
}
