import {
  delegate,
  projectsGet,
  projectsList,
  status,
  threadsGet,
  threadsList,
  threadsMessage,
  threadsMessages,
  wait,
} from "@capy-kit/core";
import { defineCommand, runMain } from "citty";

import { argsForOp, buildCtx, driveWait, emit, fail, formatOf, globalArgs, numOpt, opCommand, withTagsHint } from "../build.js";
import { initCommand } from "../commands/init.js";

// delegate is custom: it adds the cross-op `--wait` convenience (delegate then wait).
const delegateCommand = defineCommand({
  meta: { name: "delegate", description: delegate.summary },
  args: {
    ...argsForOp(delegate),
    wait: { type: "boolean", description: "After creating, poll until the thread settles." },
    timeoutSec: { type: "string", description: "Wait timeout in seconds (with --wait)." },
    intervalSec: { type: "string", description: "Poll interval in seconds (with --wait)." },
    ...globalArgs,
  },
  async run({ args }) {
    const fmt = formatOf(args);
    try {
      const ctx = buildCtx(args);
      const result = await delegate.run(args as unknown as Parameters<typeof delegate.run>[0], ctx);
      if (!args.wait) {
        emit("delegate", result, fmt);
        return;
      }
      const waitOpts = {
        id: result.threadId,
        timeoutSec: numOpt(args.timeoutSec),
        intervalSec: numOpt(args.intervalSec),
      };
      if (fmt === "json") {
        // Single JSON document for the combined op (don't print two top-level objects).
        const final = await driveWait(ctx, waitOpts, fmt, { emitFinal: false });
        process.stdout.write(JSON.stringify({ delegate: result, wait: final }, null, 2) + "\n");
      } else {
        emit("delegate", result, fmt);
        await driveWait(ctx, waitOpts, fmt);
      }
    } catch (e) {
      fail(withTagsHint(e, Boolean(args.tags)), fmt);
    }
  },
});

// wait is custom: it streams ticks and sets exit 1 when not terminal.
const waitCommand = defineCommand({
  meta: { name: "wait", description: wait.summary },
  args: { ...argsForOp(wait), ...globalArgs },
  async run({ args }) {
    const fmt = formatOf(args);
    try {
      await driveWait(
        buildCtx(args),
        { id: String(args.id), timeoutSec: numOpt(args.timeoutSec), intervalSec: numOpt(args.intervalSec) },
        fmt,
      );
    } catch (e) {
      fail(e, fmt);
    }
  },
});

const threadsCommand = defineCommand({
  meta: { name: "threads", description: "List, get, observe, and steer threads." },
  subCommands: {
    list: opCommand(threadsList),
    get: opCommand(threadsGet),
    message: opCommand(threadsMessage),
    messages: opCommand(threadsMessages),
  },
});

const projectsCommand = defineCommand({
  meta: { name: "projects", description: "List and get projects (discover project ids)." },
  subCommands: {
    list: opCommand(projectsList),
    get: opCommand(projectsGet),
  },
});

const main = defineCommand({
  meta: { name: "capy", version: "0.0.0", description: "Manage Capy from the terminal. Capy manages the work." },
  subCommands: {
    init: initCommand,
    delegate: delegateCommand,
    wait: waitCommand,
    threads: threadsCommand,
    status: opCommand(status),
    projects: projectsCommand,
  },
});

runMain(main);
