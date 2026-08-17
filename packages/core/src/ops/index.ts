import type { Op } from "./define.js";
import { delegate } from "./delegate.js";
import { wait, waitForThread } from "./poll.js";
import { reviewsAcceptBillingTransfer, reviewsBillingTransfer, reviewsCancelBillingTransfer, reviewsConfigure, reviewsDeclineBillingTransfer, reviewsOfferBillingTransfer, reviewsSettings, reviewsStart } from "./reviews.js";
import { status } from "./status.js";
import { tasksGet, tasksMessages, threadsArchive, threadsCancelMessage, threadsGet, threadsInterrupt, threadsList, threadsMessage, threadsMessages, threadsRegenerateTitle, threadsRename, threadsSendMessageNow, threadsTasks, threadsUnarchive } from "./threads.js";
import { usageGet } from "./usage.js";

export const OPS: Op[] = [delegate, threadsList, threadsGet, threadsRename, threadsInterrupt, threadsArchive, threadsUnarchive, threadsRegenerateTitle, threadsMessage, threadsMessages, threadsCancelMessage, threadsSendMessageNow, threadsTasks, tasksGet, tasksMessages, usageGet, reviewsStart, reviewsSettings, reviewsConfigure, reviewsBillingTransfer, reviewsOfferBillingTransfer, reviewsAcceptBillingTransfer, reviewsCancelBillingTransfer, reviewsDeclineBillingTransfer, wait, status];
export const opsByName = Object.freeze(Object.fromEntries(OPS.map((x) => [x.name, x])));
export { delegate, wait, waitForThread, status, threadsList, threadsGet, threadsRename, threadsInterrupt, threadsArchive, threadsUnarchive, threadsRegenerateTitle, threadsMessage, threadsMessages, threadsCancelMessage, threadsSendMessageNow, threadsTasks, tasksGet, tasksMessages, usageGet, reviewsStart, reviewsSettings, reviewsConfigure, reviewsBillingTransfer, reviewsOfferBillingTransfer, reviewsAcceptBillingTransfer, reviewsCancelBillingTransfer, reviewsDeclineBillingTransfer };
