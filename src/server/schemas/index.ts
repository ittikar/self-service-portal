import { z } from "zod";
import { buildZodSchema, type ResourceDef } from "./_types";
import { RESOURCE_DEFS } from "./definitions";

const schemaByType = new Map<string, z.ZodTypeAny>(
  RESOURCE_DEFS.map((def) => [def.type, buildZodSchema(def)]),
);

export type ResourceType = (typeof RESOURCE_DEFS)[number]["type"];

export const RESOURCE_CATALOG = RESOURCE_DEFS.map((def) => ({
  type: def.type,
  label: def.label,
  description: def.description,
  layer: def.layer,
}));

export function getResourceDef(type: string): ResourceDef | undefined {
  return RESOURCE_DEFS.find((d) => d.type === type);
}

export function getResourceSchema(type: string): z.ZodTypeAny | undefined {
  return schemaByType.get(type);
}

export const manifestSchema = z
  .object({ resource: z.string() })
  .passthrough()
  .superRefine((value, ctx) => {
    const schema = schemaByType.get(value.resource as string);
    if (!schema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown resource type: ${value.resource}`,
      });
      return;
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export type Manifest = z.infer<typeof manifestSchema>;
