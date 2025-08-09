import Ajv from "ajv";
import type { JSONSchema7 } from "./util/jsonschema";

export function validateWithSchema(schema: JSONSchema7 | undefined, data: unknown) {
  if (!schema) return { valid: true } as const;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return { valid: !!valid, errors: validate.errors ?? [] } as const;
}
