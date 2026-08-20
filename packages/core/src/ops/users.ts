import { z } from "zod";
import { resources } from "../client/resources.js";
import { defineOp } from "./define.js";

export const usersList = defineOp({ name: "users.list", summary: "List organization users.", effect: "read", input: z.object({}), output: z.object({ items: z.array(z.object({ id: z.string(), email: z.string().nullable(), firstName: z.string().nullable(), lastName: z.string().nullable() })) }), run: (_a, c) => resources(c).users.list() });
