import { describe, expect, it } from "vitest";
import { delegate, resources, resolveContext, threadsInterrupt, threadsList, threadsMessage, waitForThread } from "../src/index.js";
import { makeMockFetch, testContext } from "./helpers/mock.js";

const thread={id:"jam_1",projectId:"proj_test",title:null,titleCustom:false,status:"active",archived:false,lastModelId:null,usage:{llmCredits:0,vmCredits:0,totalCredits:0},createdAt:"2026-08-10T00:00:00.000Z",updatedAt:"2026-08-10T00:00:00.000Z",lastActivityAt:"2026-08-10T00:00:00.000Z"} as const;
describe("current Capy API",()=>{
 it("uses the new base URL and creates idempotently with requestId/message",async()=>{const {fetch,calls}=makeMockFetch(()=>({json:thread}));const out=await delegate.run({message:"fix it",requestId:"request-1"},testContext({fetch}));expect(out.threadId).toBe("jam_1");expect(calls[0]?.path).toBe("/api/v1/threads");expect(calls[0]?.body).toMatchObject({requestId:"request-1",projectId:"proj_test",message:"fix it"});});
 it("uses cursor pagination and text/delivery messages",async()=>{let n=0;const {fetch,calls}=makeMockFetch(c=>{if(c.path.endsWith("/message"))return{json:{id:"01K",deduped:false}};n++;return{json:{items:[{...thread,id:`jam_${n}`}],cursor:n===1?"next":null}}});const c=testContext({fetch});expect((await threadsList.run({},c)).cursor).toBe("next");await threadsMessage.run({id:"jam_1",text:"focus",delivery:"steer"},c);expect(calls[1]?.body).toEqual({text:"focus",delivery:"steer"});});
 it("interrupts rather than using the retired stop route",async()=>{const {fetch,calls}=makeMockFetch(()=>({json:thread}));await threadsInterrupt.run({id:"jam_1"},testContext({fetch}));expect(calls[0]?.path).toBe("/api/v1/threads/jam_1/interrupt");});
 it("waits on active then settles ready_for_review",async()=>{let n=0;const {fetch}=makeMockFetch(()=>({json:{...thread,status:++n===1?"active":"ready_for_review"}}));const out=await waitForThread(testContext({fetch}),{id:"jam_1",intervalMs:1,timeoutMs:100});expect(out).toMatchObject({terminal:true,settled:true,status:"ready_for_review"});});
 it("reads the configured new default URL",()=>expect(resolveContext({fetch:globalThis.fetch}).baseUrl).toBe("https://api.capy.ai/api/v1"));
});
