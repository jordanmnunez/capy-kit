import { stripVTControlCharacters } from "node:util";
export type OutputFormat="human"|"json";
export const sanitizeTerminalText=(v:string)=>stripVTControlCharacters(v).replace(/[\u0000-\u001f\u007f-\u009f]/g,"");
export function render(op:string,data:unknown,format:OutputFormat){if(format==="json")return JSON.stringify(data,null,2);const x=data as any;if(op==="delegate")return `delegated → ${x.threadId}  status=${x.status}\n${x.url}`;if(op==="threads.message")return `message → ${x.id}${x.deduped?" (deduped)":""}`;if(op==="wait")return `status=${x.status} ${x.terminal?"done":x.timedOut?"timed out":"settled"}`;if(x?.items)return x.items.map((i:any)=>`${i.id}  ${i.status??i.source??""}  ${i.title??i.text??""}`).join("\n")||"No results.";return JSON.stringify(data,null,2)}
