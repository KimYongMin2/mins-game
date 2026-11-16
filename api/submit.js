//#region src/server/env.ts
const env = globalThis.process?.env ?? {};
const SUPABASE_URL = "https://fxekefrjsmnmcuoaynfa.supabase.co";
/** Supabase 비밀 키 (sb_secret_… 또는 예전 service_role). Vercel 환경 변수에만 */
const supabaseSecret = () => env.SUPABASE_SECRET_KEY;
//#endregion
//#region src/server/db.ts
function headers(secret) {
	return secret.startsWith("sb_secret_") ? { apikey: secret } : {
		apikey: secret,
		authorization: `Bearer ${secret}`
	};
}
/** 넣기. 같은 id가 이미 있으면 'duplicate' */
async function insertRow(secret, table, row) {
	const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
		method: "POST",
		headers: {
			...headers(secret),
			"content-type": "application/json",
			prefer: "return=minimal"
		},
		body: JSON.stringify(row)
	});
	if (res.ok) return "ok";
	const text = await res.text();
	if (res.status === 409 || text.includes("23505")) return "duplicate";
	console.warn("[db] 넣기 실패", table, res.status, text.slice(0, 200));
	return "error";
}
/** 조건에 맞는 가장 최근 한 줄 (query는 PostgREST 꼴, 예: 'player_id=eq.x&difficulty=eq.hard') */
async function latestRow(secret, table, query, columns) {
	const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${query}&order=created_at.desc&limit=1`, { headers: headers(secret) });
	if (!res.ok) throw new Error(`읽기 실패 ${res.status}`);
	return (await res.json())[0] ?? null;
}
//#endregion
//#region src/games/fight/constants.ts
/** 자세를 고르는 시간 */
const CHOOSE_MS = 2e3;
/** 공개한 결과를 보여주는 시간 */
const REVEAL_MS = 1200;
/** 첫 턴 전 '시작!' 표시 */
const INTRO_MS = 1200;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS = 1800;
//#endregion
//#region src/shared/random.ts
function createRng(seed) {
	let s = seed >>> 0;
	return {
		next() {
			s = s + 1831565813 >>> 0;
			let t = s;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		},
		seed: () => s
	};
}
/** 가중치에 따라 하나를 고른다. */
function pickWeighted(rng, weights) {
	const entries = Object.entries(weights);
	const total = entries.reduce((sum, [, w]) => sum + w, 0);
	let r = rng.next() * total;
	for (const [value, w] of entries) {
		r -= w;
		if (r < 0) return value;
	}
	return entries[entries.length - 1][0];
}
//#endregion
//#region src/games/fight/rules/turn.ts
const STANCES = [
	"ready",
	"guard",
	"attack",
	"smash"
];
/** 자세마다 쓰는 스택 */
const STANCE_COST = {
	ready: 0,
	guard: 0,
	attack: 1,
	smash: 3
};
const FRESH = {
	life: 3,
	stacks: 0
};
/** 생명력이 깎이는 일 */
const HURT_EVENTS = [
	"hurt",
	"pierced",
	"overpowered"
];
function isHurt(event) {
	return HURT_EVENTS.includes(event);
}
function canChoose(fighter, stance) {
	return fighter.stacks >= STANCE_COST[stance];
}
/** 고를 수 없는 자세(스택이 모자란 공격)는 준비로 바꾼다 */
function sanitize(fighter, stance) {
	return canChoose(fighter, stance) ? stance : "ready";
}
function eventOf(mine, theirs, me) {
	if (mine === "smash") return theirs === "smash" ? "clash" : "smash-hit";
	if (mine === "attack") {
		if (theirs === "smash") return "overpowered";
		if (theirs === "attack") return "clash";
		return theirs === "guard" ? "blocked" : "strike";
	}
	if (mine === "guard") {
		if (theirs === "smash") return "pierced";
		return theirs === "attack" ? "block" : "guard";
	}
	if (theirs === "attack" || theirs === "smash") return "hurt";
	return me.stacks >= 3 ? "charge-full" : "charge";
}
function apply(f, stance, event) {
	const gained = event === "charge" ? 1 : 0;
	return {
		life: Math.max(0, f.life - (isHurt(event) ? 1 : 0)),
		stacks: f.stacks - STANCE_COST[stance] + gained
	};
}
function resolveTurn(fighters, chosen) {
	const stances = [sanitize(fighters[0], chosen[0]), sanitize(fighters[1], chosen[1])];
	const events = [eventOf(stances[0], stances[1], fighters[0]), eventOf(stances[1], stances[0], fighters[1])];
	return {
		stances,
		events,
		fighters: [apply(fighters[0], stances[0], events[0]), apply(fighters[1], stances[1], events[1])]
	};
}
/** turnsPlayed: 지금까지 끝난 턴 수 */
function winnerOf(fighters, turnsPlayed) {
	const [a, b] = fighters;
	if (a.life <= 0 && b.life <= 0) return "draw";
	if (b.life <= 0) return 0;
	if (a.life <= 0) return 1;
	if (turnsPlayed < 30) return null;
	if (a.life === b.life) return "draw";
	return a.life > b.life ? 0 : 1;
}
//#endregion
//#region src/games/fight/bot/fightBot.ts
const w = (ready, guard, attack, smash = 0) => ({
	ready,
	guard,
	attack,
	smash
});
/** 일반: 내 스택만 보고 대충 고른다. 꽉 차면 강타를 자주 */
function normalWeights(self) {
	if (self.stacks === 0) return w(70, 30, 0);
	if (self.stacks < 3) return w(40, 25, 35);
	return w(0, 15, 25, 60);
}
/** 어려움: 상대 스택과 상대가 고른 자세의 흐름을 읽는다 */
function hardWeights(self, foe, foeHistory) {
	const full = self.stacks >= 3;
	let weights;
	if (foe.stacks === 0) {
		if (self.stacks === 0) weights = w(100, 0, 0);
		else if (!full) weights = w(45, 0, 55);
		else weights = w(0, 0, 25, 75);
	} else if (foe.stacks >= 3) {
		if (full) weights = w(0, 10, 10, 80);
		else if (self.stacks > 0) weights = w(30, 30, 40);
		else weights = w(50, 50, 0);
	} else if (self.stacks === 0) weights = w(50, 50, 0);
	else if (!full) weights = w(25, 40, 35);
	else weights = w(0, 20, 10, 70);
	const [last, before] = [foeHistory.at(-1), foeHistory.at(-2)];
	if (last && last === before) {
		if (last === "ready" && self.stacks > 0) weights = {
			...weights,
			attack: weights.attack + 40
		};
		if (last === "guard") weights = full ? {
			...weights,
			smash: weights.smash + 40
		} : {
			...weights,
			ready: weights.ready + 40
		};
		if (last === "attack") weights = {
			...weights,
			guard: weights.guard + 40
		};
	}
	return weights;
}
function chooseBotStance(opts) {
	const { rng, difficulty, self, foe, foeHistory } = opts;
	return sanitize(self, pickWeighted(rng, difficulty === "hard" ? hardWeights(self, foe, foeHistory) : normalWeights(self)));
}
function withSounds(state, ...names) {
	let seq = state.soundSeq;
	const added = names.map((name) => ({
		id: ++seq,
		name
	}));
	return {
		...state,
		sounds: [...state.sounds, ...added].slice(-8),
		soundSeq: seq
	};
}
function createMatch(opts) {
	return {
		now: opts.now,
		seed: opts.seed,
		difficulty: opts.difficulty,
		controllers: opts.controllers ?? ["user", "bot"],
		follow: opts.follow ?? false,
		fighters: [FRESH, FRESH],
		turns: [],
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS
		},
		sounds: [],
		soundSeq: 0
	};
}
/** 새 턴: 봇은 이때 몰래 고른다 */
function startChoosing(state) {
	const rng = createRng(state.seed);
	const picks = [null, null];
	state.controllers.forEach((c, i) => {
		if (c !== "bot") return;
		const side = i;
		const other = 1 - side;
		picks[side] = chooseBotStance({
			rng,
			difficulty: state.difficulty,
			self: state.fighters[side],
			foe: state.fighters[other],
			foeHistory: state.turns.map((t) => t.stances[other])
		});
	});
	const inputUntil = state.now + CHOOSE_MS;
	const waitRemote = !state.follow && state.controllers.includes("remote");
	return {
		...state,
		seed: rng.seed(),
		phase: {
			kind: "choosing",
			index: state.turns.length,
			inputUntil,
			until: inputUntil + (waitRemote ? 300 : 0),
			picks
		}
	};
}
function turnSounds(result) {
	const e = result.events;
	if (e.includes("smash-hit")) return ["smash"];
	if (e.includes("strike")) return ["hit"];
	if (e.includes("clash")) return ["clash"];
	if (e.includes("block")) return ["block"];
	if (e.includes("charge")) return ["charge"];
	return ["guard"];
}
function reveal(state, picks) {
	const chosen = [picks[0] ?? "ready", picks[1] ?? "ready"];
	const result = resolveTurn(state.fighters, chosen);
	return withSounds({
		...state,
		fighters: result.fighters,
		turns: [...state.turns, result],
		phase: {
			kind: "reveal",
			result,
			until: state.now + REVEAL_MS
		}
	}, ...turnSounds(result));
}
function tick(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "intro": return now >= phase.until && !state.follow ? startChoosing(state) : state;
		case "choosing": return now >= phase.until && !state.follow ? reveal(state, phase.picks) : state;
		case "reveal": {
			if (now < phase.until) return state;
			const winner = winnerOf(state.fighters, state.turns.length);
			if (winner === null) return state.follow ? state : startChoosing(state);
			const userSide = state.controllers.indexOf("user");
			return withSounds({
				...state,
				phase: {
					kind: "done",
					winner,
					until: now + DONE_MS
				}
			}, winner === userSide ? "win" : "lose");
		}
		case "done": return state;
	}
}
function pick(state, side, stance) {
	const { phase } = state;
	if (phase.kind !== "choosing" || state.controllers[side] !== "user" || state.now >= phase.inputUntil) return state;
	if (!canChoose(state.fighters[side], stance) || phase.picks[side] === stance) return state;
	return withSounds({
		...state,
		phase: {
			...phase,
			picks: withPick(phase.picks, side, stance)
		}
	}, "tick");
}
function withPick(picks, side, stance) {
	return side === 0 ? [stance, picks[1]] : [picks[0], stance];
}
function remotePick(state, side, turn, stance) {
	const { phase } = state;
	if (phase.kind !== "choosing" || phase.index !== turn || state.controllers[side] !== "remote") return state;
	if (!canChoose(state.fighters[side], stance)) return state;
	return {
		...state,
		phase: {
			...phase,
			picks: withPick(phase.picks, side, stance)
		}
	};
}
/** 지금 이 턴을 받을 수 있는지 (친구 쪽, 아직 경기 중) */
function awaitingTurn(state, turn) {
	const { kind } = state.phase;
	return state.follow && turn === state.turns.length && (kind === "intro" || kind === "reveal");
}
function remoteTurn(state, turn) {
	if (!awaitingTurn(state, turn) || winnerOf(state.fighters, state.turns.length) !== null) return state;
	return startChoosing(state);
}
function remoteReveal(state, turn, stances) {
	if (!state.follow || turn !== state.turns.length) return state;
	const { kind } = state.phase;
	if (kind !== "choosing" && kind !== "intro" && kind !== "reveal") return state;
	return reveal(state, stances);
}
function matchReducer(state, action) {
	switch (action.type) {
		case "tick": return tick({
			...state,
			now: action.now
		});
		case "pick": return pick(state, action.side, action.stance);
		case "remotePick": return remotePick(state, action.side, action.turn, action.stance);
		case "remoteTurn": return remoteTurn(state, action.turn);
		case "remoteReveal": return remoteReveal(state, action.turn, action.stances);
	}
}
function summarizeMatch(state) {
	if (state.phase.kind !== "done") throw new Error("경기가 아직 안 끝났어요");
	const me = state.controllers.indexOf("user");
	const { winner } = state.phase;
	return {
		mode: state.controllers.includes("remote") ? "pvp" : "bot",
		difficulty: state.difficulty,
		outcome: winner === "draw" ? "draw" : winner === me ? "win" : "lose",
		turns: state.turns.length,
		life: [state.fighters[me].life, state.fighters[1 - me].life],
		strikes: state.turns.filter((t) => t.events[me] === "strike").length,
		moves: state.turns.map((t) => t.stances[me])
	};
}
//#endregion
//#region src/server/games/fight.ts
function replayFight(seed, difficulty, moves) {
	if (difficulty !== "normal" && difficulty !== "hard") return null;
	if (!Array.isArray(moves) || moves.length > 30 || !moves.every((m) => STANCES.includes(m))) return null;
	let s = createMatch({
		now: 0,
		seed,
		difficulty
	});
	let guard = 0;
	while (s.phase.kind !== "done" && guard++ < 200) {
		const { phase } = s;
		if (phase.kind === "choosing") {
			const move = moves[phase.index];
			if (move === void 0) return null;
			s = matchReducer(s, {
				type: "pick",
				side: 0,
				stance: move
			});
			if (((s.phase.kind === "choosing" ? s.phase.picks[0] : null) ?? "ready") !== move) return null;
		}
		s = matchReducer(s, {
			type: "tick",
			now: s.phase.kind === "done" ? s.now : s.phase.until
		});
	}
	if (s.phase.kind !== "done" || s.turns.length !== moves.length) return null;
	const sum = summarizeMatch(s);
	return {
		difficulty,
		outcome: sum.outcome,
		turns: sum.turns
	};
}
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
/** 이 사용자가 이 게임에 받은, 아직 안 지난 진짜 티켓인지 */
async function checkTicket(secret, x, game, uid, now = Date.now()) {
	if (!x || typeof x !== "object") return null;
	const t = x;
	if (typeof t.id !== "string" || !/^[0-9a-f-]{36}$/.test(t.id) || t.game !== game || t.uid !== uid) return null;
	if (typeof t.seed !== "number" || !Number.isInteger(t.seed) || typeof t.exp !== "number" || t.exp < now || typeof t.sig !== "string") return null;
	const ticket = {
		id: t.id,
		game,
		uid,
		seed: t.seed,
		exp: t.exp
	};
	const sig = await hmac(secret, payload(ticket));
	if (sig.length !== t.sig.length) return null;
	let diff = 0;
	for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ t.sig.charCodeAt(i);
	return diff === 0 ? {
		...ticket,
		sig
	} : null;
}
//#endregion
//#region src/server/submitApi.ts
const cleanNick = (x) => (typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 10) : "") || "익명";
async function submitApi(req) {
	if (!fromOurSite(req)) return json(403, { error: "forbidden" });
	const secret = supabaseSecret();
	if (!secret) return json(500, { error: "not-configured" });
	const body = await readJson(req);
	if (!body || typeof body.game !== "string") return json(400, { error: "bad-request" });
	const uid = await userIdOf(req);
	if (!uid) return json(401, { error: "unauthorized" });
	const ticket = await checkTicket(secret, body.ticket, body.game, uid);
	if (!ticket) return json(400, { error: "bad-ticket" });
	const data = body.data ?? {};
	const nickname = cleanNick(body.nickname);
	if (body.game === "fight") {
		const r = replayFight(ticket.seed, data.difficulty, data.moves);
		if (!r) return json(400, { error: "replay-mismatch" });
		const last = await latestRow(secret, "fight_games", `player_id=eq.${uid}&difficulty=eq.${r.difficulty}`, "win_streak");
		const streak = r.outcome === "win" ? (last?.win_streak ?? 0) + 1 : 0;
		const res = await insertRow(secret, "fight_games", {
			id: ticket.id,
			player_id: uid,
			nickname,
			difficulty: r.difficulty,
			outcome: r.outcome,
			turns: r.turns,
			win_streak: streak
		});
		return res === "ok" ? json(200, {
			ok: true,
			outcome: r.outcome
		}) : res === "duplicate" ? json(409, { error: "duplicate" }) : json(500, { error: "db" });
	}
	return json(400, { error: "bad-request" });
}
//#endregion
//#region server-entry/submit.ts
const POST = submitApi;
//#endregion
export { POST };
