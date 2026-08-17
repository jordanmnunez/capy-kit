import { z } from "zod";
import { resources } from "../client/resources.js";
import { defineOp } from "./define.js";

const repo = z.string().min(1);
const reviewSettings = z.object({ repo, billingOrgId: z.string().nullable(), heldByCaller: z.boolean(), autoReview: z.enum(["off", "once", "always"]), postingThreshold: z.enum(["low", "medium", "high"]), postInvestigate: z.boolean(), postNotes: z.boolean() });
const billingTransfer = z.object({ repo, billingOrgId: z.string().nullable(), offer: z.object({ fromOrgId: z.string(), toOrgId: z.string(), createdAt: z.string() }).nullable() });

export const reviewsStart = defineOp({
  name: "reviews.start",
  summary: "Start a Capy review for a pull request.",
  effect: "create",
  input: z.object({ repo: z.string().min(1), prNumber: z.coerce.number().int().positive(), idempotencyKey: z.string().min(1).max(191).optional(), forceRefresh: z.coerce.boolean().optional(), sourceThreadId: z.string().min(1).optional(), model: z.string().min(1).optional(), effort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional() }),
  output: z.object({ reviewId: z.string(), requestId: z.string(), threadId: z.string(), headSha: z.string(), adopted: z.boolean(), sourceRecorded: z.boolean().optional() }),
  run: (a, c) => resources(c).reviews.start(a),
});

export const reviewsSettings = defineOp({ name: "reviews.settings", summary: "Get review settings for a repository.", effect: "read", input: z.object({ repo }), output: reviewSettings, run: (a, c) => resources(c).reviews.settings(a.repo) });
export const reviewsConfigure = defineOp({ name: "reviews.configure", summary: "Configure review settings for a repository.", effect: "mutate", input: z.object({ repo, autoReview: z.enum(["off", "once", "always"]).optional(), postingThreshold: z.enum(["low", "medium", "high"]).optional(), postInvestigate: z.coerce.boolean().optional(), postNotes: z.coerce.boolean().optional() }), output: reviewSettings, run: (a, c) => resources(c).reviews.configure(a) });
export const reviewsBillingTransfer = defineOp({ name: "reviews.billing-transfer", summary: "Get review billing-transfer state.", effect: "read", input: z.object({ repo }), output: billingTransfer, run: (a, c) => resources(c).reviews.billingTransfer(a.repo) });
export const reviewsOfferBillingTransfer = defineOp({ name: "reviews.offer-billing-transfer", summary: "Offer review billing transfer to another organization.", effect: "mutate", input: z.object({ repo, targetOrgId: z.string().min(1) }), output: billingTransfer, run: (a, c) => resources(c).reviews.offerBillingTransfer(a) });
const billingAction = (name: string, summary: string, action: "acceptBillingTransfer" | "cancelBillingTransfer" | "declineBillingTransfer") => defineOp({ name, summary, effect: "mutate" as const, input: z.object({ repo }), output: billingTransfer, run: (a, c) => resources(c).reviews[action](a) });
export const reviewsAcceptBillingTransfer = billingAction("reviews.accept-billing-transfer", "Accept a review billing-transfer offer.", "acceptBillingTransfer");
export const reviewsCancelBillingTransfer = billingAction("reviews.cancel-billing-transfer", "Cancel an offered review billing transfer.", "cancelBillingTransfer");
export const reviewsDeclineBillingTransfer = billingAction("reviews.decline-billing-transfer", "Decline a review billing-transfer offer.", "declineBillingTransfer");
