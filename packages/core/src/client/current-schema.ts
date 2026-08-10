/** Temporary current Capy API contract from the creator migration brief (2026-08-10).
 * Replace this file with generated types once Capy publishes the matching OpenAPI document. */
export const THREAD_STATUSES=["active","waiting","pending_user","error","ready_for_review","idle","archived"] as const;
export type ThreadStatus=typeof THREAD_STATUSES[number];
export interface Usage{llmCredits:number;vmCredits:number;totalCredits:number}
export interface Thread{id:string;title:string|null;titleCustom:boolean;status:ThreadStatus;archived:boolean;lastModelId:string|null;usage:Usage;createdAt:string;updatedAt:string;lastActivityAt:string}
export interface Page<T>{items:T[];cursor:string|null}
export interface Message{id:string;source:"user"|"assistant"|"tool";text:string;createdAt:string;tool?:unknown;model?:string;attachments?:unknown;authorName?:string}
export interface CreateThreadBody{requestId:string;message:string;title?:string;model?:{modelId:string;reasoningMode?:string;modes?:{fast?:boolean}};machineSize?:"small"|"medium"|"large"|"ultra"|"hyper"|"bigguy"}
export interface SendMessageBody{text:string;delivery?:"interrupt"|"queue"|"steer";model?:CreateThreadBody["model"]}
export interface Task{id:string;threadId:string;parentId:string|null;taskPath:string;title:string;status:"working"|"waiting"|"idle"|"done"|"failed";usage:Usage;createdAt:string;updatedAt:string}
