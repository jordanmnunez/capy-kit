import type { CapyContext } from "./context.js";
import type { components } from "./schema.js";
import { request } from "./transport.js";

export type Thread = components["schemas"]["Thread"];
export type Task = components["schemas"]["Task"];
export type Message = components["schemas"]["Message"];
export type CreateThreadBody = components["schemas"]["CreateThreadRequest"];
export type SendMessageBody = components["schemas"]["SendMessageRequest"];
export type RenameThreadBody = components["schemas"]["RenameThreadRequest"];
export type UsageReport = components["schemas"]["UsageReport"];
export type ReviewStarted = components["schemas"]["ReviewStarted"];
export type StartReviewBody = components["schemas"]["StartReviewRequest"];
export type ReviewSettings = components["schemas"]["ReviewSettings"];
export type ConfigureReviewBody = components["schemas"]["ConfigureReviewRequest"];
export type ReviewBillingTransferState = components["schemas"]["ReviewBillingTransferState"];
export type OfferReviewBillingTransferBody = components["schemas"]["OfferReviewBillingTransferRequest"];
export type ReviewBillingTransferBody = components["schemas"]["ReviewBillingTransferRequest"];
export type Page<T> = { items: T[]; cursor: string | null };
export type ThreadMessage = Message;
export type ListThreadsResponse = Page<Thread>;
export type ListMessagesResponse = Page<Message>;
export type SendThreadMessageBody = SendMessageBody;
export type ThreadListItem = Thread;
export type CreateThreadResponse = Thread;

export type ListThreadsQuery = { projectId: string; status?: Exclude<Thread["status"], "archived">; limit?: number; cursor?: string };
export type ListMessagesQuery = { after?: string; limit?: number };

const e = encodeURIComponent;

export function resources(c: CapyContext) {
  return {
    threads: {
      create: (b: CreateThreadBody, s?: AbortSignal) => request<Thread>(c, { method: "POST", path: "/threads", body: b, signal: s, idempotent: true }),
      get: (id: string, s?: AbortSignal) => request<Thread>(c, { method: "GET", path: `/threads/${e(id)}`, signal: s }),
      list: (q: ListThreadsQuery, s?: AbortSignal) => request<Page<Thread>>(c, { method: "GET", path: "/threads", query: q, signal: s }),
      rename: (id: string, b: RenameThreadBody, s?: AbortSignal) => request<Thread>(c, { method: "PATCH", path: `/threads/${e(id)}`, body: b, signal: s }),
      interrupt: (id: string, s?: AbortSignal) => request<Thread>(c, { method: "POST", path: `/threads/${e(id)}/interrupt`, signal: s }),
      archive: (id: string, s?: AbortSignal) => request<Thread>(c, { method: "POST", path: `/threads/${e(id)}/archive`, signal: s }),
      unarchive: (id: string, s?: AbortSignal) => request<Thread>(c, { method: "POST", path: `/threads/${e(id)}/unarchive`, signal: s }),
      regenerateTitle: (id: string, s?: AbortSignal) => request<Thread>(c, { method: "POST", path: `/threads/${e(id)}/regenerate-title`, signal: s }),
      message: (id: string, b: SendMessageBody, s?: AbortSignal) => request<{ id: string; deduped: boolean }>(c, { method: "POST", path: `/threads/${e(id)}/message`, body: b, signal: s, idempotent: false }),
      messages: (id: string, q: ListMessagesQuery = {}, s?: AbortSignal) => request<Page<Message>>(c, { method: "GET", path: `/threads/${e(id)}/messages`, query: q, signal: s }),
      cancelMessage: (id: string, eventId: string, s?: AbortSignal) => request<{ outcome: "cancelled" | "tooLate" }>(c, { method: "POST", path: `/threads/${e(id)}/messages/${e(eventId)}/cancel`, signal: s }),
      sendMessageNow: (id: string, eventId: string, s?: AbortSignal) => request<{ outcome: "sent" | "tooLate"; id?: string }>(c, { method: "POST", path: `/threads/${e(id)}/messages/${e(eventId)}/send-now`, signal: s }),
      tasks: (id: string, q: { after?: string; limit?: number } = {}, s?: AbortSignal) => request<Page<Task>>(c, { method: "GET", path: `/threads/${e(id)}/tasks`, query: q, signal: s }),
    },
    tasks: {
      get: (id: string, s?: AbortSignal) => request<Task>(c, { method: "GET", path: `/tasks/${e(id)}`, signal: s }),
      messages: (id: string, q: ListMessagesQuery = {}, s?: AbortSignal) => request<Page<Message>>(c, { method: "GET", path: `/tasks/${e(id)}/messages`, query: q, signal: s }),
    },
    usage: {
      get: (q: { from?: string; to?: string } = {}, s?: AbortSignal) => request<UsageReport>(c, { method: "GET", path: "/usage", query: q, signal: s }),
    },
    reviews: {
      start: (b: StartReviewBody, s?: AbortSignal) => request<ReviewStarted>(c, { method: "POST", path: "/reviews", body: b, signal: s, idempotent: false }),
      settings: (repo: string, s?: AbortSignal) => request<ReviewSettings>(c, { method: "GET", path: "/review-settings", query: { repo }, signal: s }),
      configure: (b: ConfigureReviewBody, s?: AbortSignal) => request<ReviewSettings>(c, { method: "PUT", path: "/review-settings", body: b, signal: s }),
      billingTransfer: (repo: string, s?: AbortSignal) => request<ReviewBillingTransferState>(c, { method: "GET", path: "/review-billing-transfer", query: { repo }, signal: s }),
      offerBillingTransfer: (b: OfferReviewBillingTransferBody, s?: AbortSignal) => request<ReviewBillingTransferState>(c, { method: "POST", path: "/review-billing-transfer/offer", body: b, signal: s }),
      acceptBillingTransfer: (b: ReviewBillingTransferBody, s?: AbortSignal) => request<ReviewBillingTransferState>(c, { method: "POST", path: "/review-billing-transfer/accept", body: b, signal: s }),
      cancelBillingTransfer: (b: ReviewBillingTransferBody, s?: AbortSignal) => request<ReviewBillingTransferState>(c, { method: "POST", path: "/review-billing-transfer/cancel", body: b, signal: s }),
      declineBillingTransfer: (b: ReviewBillingTransferBody, s?: AbortSignal) => request<ReviewBillingTransferState>(c, { method: "POST", path: "/review-billing-transfer/decline", body: b, signal: s }),
    },
  };
}
