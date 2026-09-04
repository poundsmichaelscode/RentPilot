import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import Dashboard from "./dashboard";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{role?:string}>}){ const query=await searchParams;const role=query.role==="tenant"?"tenant":query.role==="landlord"?"landlord":null;const user=await requireChatGPTUser(role?`/dashboard?role=${role}`:"/dashboard"); return <Dashboard user={user} signOut={chatGPTSignOutPath("/")} initialRole={role} />; }
