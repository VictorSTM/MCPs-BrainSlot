import Ajv from "ajv";
export function validateWithSchema(schema, data) {
    if (!schema)
        return { valid: true };
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(data);
    return { valid: !!valid, errors: validate.errors ?? [] };
}
