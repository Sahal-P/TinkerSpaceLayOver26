import "server-only";

import { z } from "zod";

/** Avoid bounded-array schema expansion; Zod still validates every hard limit. */
export function modelJsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, {
    override: ({ jsonSchema }) => {
      delete jsonSchema.maxItems;
    },
  });
}
