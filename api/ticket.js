//#region src/server/env.ts
const env = globalThis.process?.env ?? {};
const SUPABASE_URL = "https://fxekefrjsmnmcuoaynfa.supabase.co";
/** Supabase 비밀 키 (sb_secret_… 또는 예전 service_role). Vercel 환경 변수에만 */
const supabaseSecret = () => env.SUPABASE_SECRET_KEY;
//#endregion
//#region src/server/http.ts
const json = (status, body) => new Response(JSON.stringify(body), {
	status,
	headers: {
		"content-type": "application/json",
		"cache-control": "no-store"
	}
});
/** 우리 사이트(브라우저가 붙이는 Origin)에서 온 요청만 — 대충 긁어 쓰는 프로그램 막기 */
function fromOurSite(req) {
	const origin = req.headers.get("origin") ?? "";
	return /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
}
/** 우리 익명 로그인(Supabase) 토큰을 서버에 물어 확인한 사용자 ID. 아니면 null */
async function userIdOf(req) {
	const auth = req.headers.get("authorization") ?? "";
	const apikey = req.headers.get("x-supabase-key") ?? "";
	if (!auth.startsWith("Bearer ") || !apikey) return null;
	try {
		const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: {
			authorization: auth,
			apikey
		} });
		if (!res.ok) return null;
		const user = await res.json();
		return typeof user.id === "string" ? user.id : null;
	} catch {
		return null;
	}
}
async function readJson(req) {
	try {
		const body = await req.json();
		return body && typeof body === "object" && !Array.isArray(body) ? body : null;
	} catch {
		return null;
	}
}
//#endregion
//#region src/server/ticket.ts
/** 티켓을 받은 뒤 이 안에 올려야 함 */
const TICKET_MS = 216e5;
const enc = new TextEncoder();
const payload = (t) => `${t.id}|${t.game}|${t.uid}|${t.seed}|${t.exp}`;
async function hmac(secret, text) {
	const key = await crypto.subtle.importKey("raw", enc.encode(`ticket:${secret}`), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
	return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function issueTicket(secret, game, uid, now = Date.now()) {
	const seed = crypto.getRandomValues(/* @__PURE__ */ new Uint32Array(1))[0];
	const t = {
		id: crypto.randomUUID(),
		game,
		uid,
		seed,
		exp: now + TICKET_MS
	};
	return {
		...t,
		sig: await hmac(secret, payload(t))
	};
}
//#endregion
//#region src/server/ticketApi.ts
const VERIFIED_GAMES = [
	"fight",
	"archery",
	"batting"
];
async function ticketApi(req) {
	if (!fromOurSite(req)) return json(403, { error: "forbidden" });
	const secret = supabaseSecret();
	if (!secret) return json(500, { error: "not-configured" });
	const game = (await readJson(req))?.game;
	if (typeof game !== "string" || !VERIFIED_GAMES.includes(game)) return json(400, { error: "bad-request" });
	const uid = await userIdOf(req);
	if (!uid) return json(401, { error: "unauthorized" });
	return json(200, { ticket: await issueTicket(secret, game, uid) });
}
//#endregion
//#region server-entry/ticket.ts
const POST = ticketApi;
//#endregion
export { POST };
