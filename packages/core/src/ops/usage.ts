import { z } from "zod";
import { resources } from "../client/resources.js";
import { defineOp } from "./define.js";

export const usageGet = defineOp({
  name: "usage.get",
  summary: "Get organization usage for a time window.",
  effect: "read",
  input: z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }),
  output: z.unknown(),
  run: (a, c) => resources(c).usage.get(a),
});
