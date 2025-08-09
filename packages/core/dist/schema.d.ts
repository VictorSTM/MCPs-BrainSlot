import type { JSONSchema7 } from "./util/jsonschema";
export declare function validateWithSchema(schema: JSONSchema7 | undefined, data: unknown): {
    readonly valid: true;
    readonly errors?: undefined;
} | {
    readonly valid: boolean;
    readonly errors: import("ajv").ErrorObject<string, Record<string, any>, unknown>[];
};
