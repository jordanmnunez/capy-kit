import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
export const initCommand=defineCommand({meta:{name:"init",description:"Configure a current Capy API key and project id."},args:{},async run(){if(!process.stdin.isTTY)throw new Error("capy init needs an interactive terminal; set CAPY_API_KEY and CAPY_PROJECT_ID instead.");const p=await import("@clack/prompts");const key=await p.password({message:"Organization-scoped Capy API key (Settings → API)"});if(p.isCancel(key))return;const projectId=await p.text({message:"Project id (from the selected project page in Capy)"});if(p.isCancel(projectId))return;const dir=join(homedir(),".capy");mkdirSync(dir,{recursive:true});const path=join(dir,"config.json");writeFileSync(path,JSON.stringify({apiKey:key,projectId},null,2)+"\n",{mode:0o600});chmodSync(path,0o600);p.outro(`Saved ${path}.`);}});
