import { describe, expect, it } from "vitest";
import { z } from "zod";
import { modelJsonSchema } from "./model-json-schema";

describe("provider JSON schema from canonical Zod fields", () => {
  it("preserves nullable and enum constraints", () => {
    const schema = z.strictObject({
      label: z.string().nullable(), incline: z.enum(["up", "down"]).nullable(),
    });
    const result = modelJsonSchema(schema);
    expect(result).toEqual(z.toJSONSchema(schema));
    expect(result.additionalProperties).toBe(false);
    expect(result.required).toEqual(["label", "incline"]);
  });
  it("omits array expansion bounds from provider schema while enforcing them with Zod", () => {
    const schema = z.strictObject({
      label: z.string().min(1).max(50).nullable(),
      values: z.array(z.string()).max(40),
      alternative: z.union([z.string(), z.number()]),
    });
    const result = modelJsonSchema(schema);
    expect(result.properties?.label).toEqual(z.toJSONSchema(schema).properties?.label);
    expect(result.properties?.values).toMatchObject({ type: "array" });
    expect(result.properties?.values).not.toHaveProperty("maxItems");
    expect(result.properties?.alternative).toEqual(z.toJSONSchema(schema).properties?.alternative);
    expect(schema.safeParse({ label: null, values: Array.from({ length: 41 }, () => "value"), alternative: "ok" }).success).toBe(false);
  });
});
