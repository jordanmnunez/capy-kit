import { delegate, reviewsAcceptBillingTransfer, reviewsBillingTransfer, reviewsCancelBillingTransfer, reviewsConfigure, reviewsDeclineBillingTransfer, reviewsOfferBillingTransfer, reviewsSettings, reviewsStart, status, tasksGet, tasksMessages, threadsArchive, threadsCancelMessage, threadsGet, threadsInterrupt, threadsList, threadsMessage, threadsMessages, threadsRegenerateTitle, threadsRename, threadsSendMessageNow, threadsTasks, threadsUnarchive, usageGet, wait } from "@capy-kit/core";
import { defineCommand, runMain } from "citty";
import { opCommand } from "../build.js";
import { initCommand } from "../commands/init.js";
import { projectsCommand } from "../commands/projects.js";

runMain(defineCommand({
  meta: { name: "capy", version: "2.0.0", description: "Current Capy API CLI." },
  subCommands: {
    init: initCommand, projects: projectsCommand, delegate: opCommand(delegate), wait: opCommand(wait), status: opCommand(status), usage: defineCommand({ meta: { name: "usage", description: "Usage reporting." }, subCommands: { get: opCommand(usageGet) } }),
    reviews: defineCommand({ meta: { name: "reviews", description: "Pull-request reviews." }, subCommands: { start: opCommand(reviewsStart), settings: opCommand(reviewsSettings), configure: opCommand(reviewsConfigure), "billing-transfer": opCommand(reviewsBillingTransfer), "offer-billing-transfer": opCommand(reviewsOfferBillingTransfer), "accept-billing-transfer": opCommand(reviewsAcceptBillingTransfer), "cancel-billing-transfer": opCommand(reviewsCancelBillingTransfer), "decline-billing-transfer": opCommand(reviewsDeclineBillingTransfer) } }),
    tasks: defineCommand({ meta: { name: "tasks", description: "Read-only task observation." }, subCommands: { get: opCommand(tasksGet), messages: opCommand(tasksMessages) } }),
    threads: defineCommand({ meta: { name: "threads", description: "Threads." }, subCommands: { list: opCommand(threadsList), get: opCommand(threadsGet), rename: opCommand(threadsRename), interrupt: opCommand(threadsInterrupt), archive: opCommand(threadsArchive), unarchive: opCommand(threadsUnarchive), "regenerate-title": opCommand(threadsRegenerateTitle), message: opCommand(threadsMessage), messages: opCommand(threadsMessages), "cancel-message": opCommand(threadsCancelMessage), "send-message-now": opCommand(threadsSendMessageNow), tasks: opCommand(threadsTasks) } }),
  },
}));
