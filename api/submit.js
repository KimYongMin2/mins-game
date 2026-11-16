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
//#region src/games/archery/constants.ts
/** 한 경기: 30m 3발 → 50m 3발 → 70m 3발 → 100m 1발 */
const ROUNDS = [
	{
		distance: 30,
		arrows: 3
	},
	{
		distance: 50,
		arrows: 3
	},
	{
		distance: 70,
		arrows: 3
	},
	{
		distance: 100,
		arrows: 1
	}
];
const TOTAL_ARROWS = ROUNDS.reduce((sum, r) => sum + r.arrows, 0);
const RING_WIDTH = .4 / 10;
const X_RADIUS = RING_WIDTH / 2;
/** 완전히 당긴 뒤 이만큼은 흔들림이 늘지 않는다 */
const FATIGUE_GRACE_MS = 2e3;
/** 한 발을 쏘는 제한 시간. '눌러서 당기기'가 뜨면 시작. 못 쏘면 0점, 당기는 중이면 바로 발사 */
const SHOT_CLOCK_MS = 1e4;
/** 누른 뒤 이 시간이 지나면 팔이 풀려 자동 발사 */
const AUTO_RELEASE_MS = 1e4;
/**
* 조준 흔들림(각도, 라디안). 거리가 멀수록 과녁 위에서는 크게 흔들린다.
* 30m 약 1링 · 100m 약 3.5링. 흔들림이 가운데를 지나는 순간에 놓는 게 실력
*/
const SWAY_ANGLE = .0014;
/**
* 바람 1m/s에 과녁에서 밀리는 거리(m). 비행 시간이 길수록 많이 밀린다. (플레이하며 조정)
* 강한 바람(6m/s) 기준 30m 약 2.5링 · 50m 약 4링 · 70m 약 5.5링 · 100m 약 8링
*/
const WIND_DRIFT_PER_MPS = {
	30: .0165,
	50: .027,
	70: .037,
	100: .053
};
/** 덜 당기고 쏘면 처지는 정도. 30m에서 반만 당기면 3~4링 아래로 */
const UNDERDRAW_DROP_AT_30M = .5;
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
function chance(rng, p) {
	return rng.next() < p;
}
function pickOne(rng, values) {
	return values[Math.floor(rng.next() * values.length)];
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
//#region src/games/archery/field/view.ts
/**
* 거리별로 화면에 보이는 범위(과녁 중심에서 가장자리까지, m). 멀수록 넓게 보여 과녁이 작아진다.
* 30m 0.75m · 100m 약 1.3m — 100m 강한 바람에 밀리는 거리(약 0.63m)를 보정해 조준할 여유가 있다.
*/
function viewHalfSize(distance) {
	return .75 * (distance / 30) ** .45;
}
//#endregion
//#region src/games/archery/rules/scoring.ts
const MISS = {
	points: 0,
	ring: 0,
	x: false
};
/** 소수점 점수를 주는 링 */
const DECIMAL_FROM_RING = 9;
const round1 = (n) => Math.round(n * 10) / 10;
/**
* 과녁 중심에서의 위치로 점수를 매긴다. 링 경계에 걸치면 안쪽(높은 점수)으로 친다.
* 9·10점 링은 링 안에서 중심에 가까울수록 0.1점씩 더 준다 (동점을 줄이기 위해).
*/
function scoreImpact(p) {
	const r = Math.hypot(p.x, p.y);
	if (r > .4) return MISS;
	const ring = Math.max(1, Math.min(10, 10 - Math.floor((r - 1e-9) / RING_WIDTH)));
	const x = r <= X_RADIUS;
	if (ring < DECIMAL_FROM_RING) return {
		points: ring,
		ring,
		x
	};
	const depth = ((11 - ring) * RING_WIDTH - r) / RING_WIDTH;
	const tenths = Math.min(9, Math.max(0, Math.floor(depth * 10 + 1e-9)));
	return {
		points: round1(ring + tenths / 10),
		ring,
		x
	};
}
/** i번째 화살(0부터)을 쏘는 거리 */
function distanceOfArrow(i) {
	let n = i;
	for (const round of ROUNDS) {
		if (n < round.arrows) return round.distance;
		n -= round.arrows;
	}
	throw new Error(`화살은 ${TOTAL_ARROWS}발뿐입니다: ${i}`);
}
/** 이 화살이 새 거리의 첫 발인지 (거리 안내용) */
function isFirstAtDistance(i) {
	return i === 0 || distanceOfArrow(i) !== distanceOfArrow(i - 1);
}
function totalOf$1(scores) {
	return {
		points: round1(scores.reduce((sum, s) => sum + s.points, 0)),
		xCount: scores.filter((s) => s.x).length,
		/** 10점 링(X 포함) 개수 — 동점일 때 비교 */
		tenCount: scores.filter((s) => s.ring === 10).length
	};
}
//#endregion
//#region src/games/archery/play/wind.ts
const WIND_TIERS = {
	light: {
		label: "약한 바람",
		min: .5,
		max: 2
	},
	medium: {
		label: "중간 바람",
		min: 2,
		max: 4
	},
	strong: {
		label: "강한 바람",
		min: 4,
		max: 6
	}
};
const DIRECTIONS = [
	0,
	1,
	2,
	3,
	4,
	5,
	6,
	7
];
const TIERS = [
	"light",
	"medium",
	"strong"
];
/** 방향 8가지 × 세기 3단계 중 무작위 */
function randomWind(rng) {
	const tier = pickOne(rng, TIERS);
	const { min, max } = WIND_TIERS[tier];
	return {
		direction: pickOne(rng, DIRECTIONS),
		tier,
		speed: Math.round((min + rng.next() * (max - min)) * 10) / 10
	};
}
/** 바람이 부는 쪽의 단위 벡터 (대각선도 길이 1) */
function windUnit(direction) {
	const angle = direction * Math.PI / 4;
	const round = (v) => Math.abs(v) < 1e-12 ? 0 : v;
	return {
		x: round(Math.sin(angle)),
		y: round(Math.cos(angle))
	};
}
/** 바람 때문에 과녁에서 밀리는 양(m) */
function windDrift(wind, distance) {
	const unit = windUnit(wind.direction);
	const amount = wind.speed * WIND_DRIFT_PER_MPS[distance];
	return {
		x: unit.x * amount,
		y: unit.y * amount
	};
}
//#endregion
//#region src/games/archery/play/shot.ts
/** 당긴 정도 0~1 */
function drawProgress(holdMs) {
	return Math.min(Math.max(holdMs / 800, 0), 1);
}
/** 흔들림 배율. 완전히 당긴 뒤 버틸수록 커진다 (팔 힘이 빠짐) */
function fatigue(holdMs) {
	const tired = holdMs - 800 - FATIGUE_GRACE_MS;
	if (tired <= 0) return 1;
	return 1 + .5 * (tired / 1e3) ** 1.5;
}
function shouldAutoRelease(holdMs) {
	return holdMs >= AUTO_RELEASE_MS;
}
/**
* 조준점 흔들림(m). 서로 다른 주기의 사인파를 겹쳐 사람 손처럼 불규칙하게 움직인다.
* phase는 화살마다 달라서 매번 다른 모양으로 흔들린다.
*/
function swayOffset(t, holdMs, distance, phase) {
	const amp = SWAY_ANGLE * distance * fatigue(holdMs);
	const s = t / 1e3;
	const x = Math.sin(s * 1.7 + phase) * .6 + Math.sin(s * 3.1 + phase * 2.3) * .3 + Math.sin(s * 5.3 + phase * .7) * .1;
	const y = Math.sin(s * 1.3 + phase * 1.9) * .6 + Math.sin(s * 2.7 + phase * .4) * .3 + Math.sin(s * 4.9 + phase * 3.1) * .1;
	return {
		x: x * amp,
		y: y * amp
	};
}
/** 덜 당기고 쏘면 아래로 처지는 양(m, 양수) */
function underdrawDrop(progress, distance) {
	return (1 - Math.min(Math.max(progress, 0), 1)) ** 1.2 * UNDERDRAW_DROP_AT_30M * (distance / 30);
}
function flightMs(distance) {
	return distance / 70 * 1e3;
}
/** 놓는 순간의 조준점 + 흔들림 + 바람 + 처짐 = 화살이 꽂히는 자리 */
function computeImpact(input) {
	const drift = windDrift(input.wind, input.distance);
	return {
		x: input.aim.x + input.sway.x + drift.x,
		y: input.aim.y + input.sway.y + drift.y - underdrawDrop(input.progress, input.distance)
	};
}
//#endregion
//#region src/games/archery/play/roundState.ts
const ANNOUNCE_MS$1 = 1400;
const SCORED_MS = 1300;
const CENTER = {
	x: 0,
	y: 0
};
function currentDistance(state) {
	return distanceOfArrow(Math.min(state.arrowIndex, TOTAL_ARROWS - 1));
}
function withSounds$3(state, ...names) {
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
/** 화살마다 새 바람과 흔들림 모양 */
function prepareArrow(state, index, now) {
	const rng = createRng(state.seed);
	const wind = randomWind(rng);
	const swayPhase = rng.next() * Math.PI * 2;
	const announce = isFirstAtDistance(index);
	const phase = announce ? {
		kind: "announce",
		until: now + ANNOUNCE_MS$1
	} : { kind: "ready" };
	return {
		...state,
		seed: rng.seed(),
		arrowIndex: index,
		wind,
		swayPhase,
		aim: CENTER,
		phase,
		deadline: announce ? null : now + SHOT_CLOCK_MS
	};
}
function createRound(now, seed) {
	return prepareArrow({
		now,
		t0: now,
		seed,
		arrowIndex: 0,
		wind: {
			direction: 0,
			tier: "light",
			speed: 0
		},
		swayPhase: 0,
		aim: CENTER,
		deadline: null,
		shots: [],
		phase: { kind: "ready" },
		sounds: [],
		soundSeq: 0
	}, 0, now);
}
function fire(state, at) {
	if (state.phase.kind !== "drawing") return state;
	const distance = currentDistance(state);
	const holdMs = Math.max(0, at - state.phase.startedAt);
	const progress = drawProgress(holdMs);
	const sway = swayOffset(at, holdMs, distance, state.swayPhase);
	const impact = computeImpact({
		aim: state.aim,
		sway,
		wind: state.wind,
		distance,
		progress
	});
	const shot = {
		index: state.arrowIndex,
		distance,
		wind: state.wind,
		impact,
		score: scoreImpact(impact),
		progress,
		pressAt: state.phase.startedAt,
		releaseAt: at,
		aim: state.aim
	};
	return withSounds$3({
		...state,
		phase: {
			kind: "flying",
			shot,
			startAt: at,
			until: at + flightMs(distance)
		}
	}, "release");
}
/** 시간 안에 못 쏜 화살: 0점, 바로 점수 표시로 */
function timeOut(state) {
	const shot = {
		index: state.arrowIndex,
		distance: currentDistance(state),
		wind: state.wind,
		impact: null,
		score: MISS,
		progress: 0,
		pressAt: null,
		releaseAt: null,
		aim: CENTER
	};
	return withSounds$3({
		...state,
		shots: [...state.shots, shot],
		phase: {
			kind: "scored",
			shot,
			until: state.now + SCORED_MS
		}
	}, "miss");
}
function hitSound$1(score) {
	if (score.x) return "x";
	if (score.ring === 10) return "ten";
	if (score.ring === 0) return "miss";
	return "hit";
}
function tick$3(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "announce": return now >= phase.until ? {
			...state,
			phase: { kind: "ready" },
			deadline: now + SHOT_CLOCK_MS
		} : state;
		case "ready": return state.deadline !== null && now >= state.deadline ? timeOut(state) : state;
		case "drawing": {
			const outOfTime = state.deadline !== null && now >= state.deadline;
			return shouldAutoRelease(now - phase.startedAt) || outOfTime ? fire(state, now) : state;
		}
		case "flying":
			if (now < phase.until) return state;
			return withSounds$3({
				...state,
				shots: [...state.shots, phase.shot],
				phase: {
					kind: "scored",
					shot: phase.shot,
					until: now + SCORED_MS
				}
			}, hitSound$1(phase.shot.score));
		case "scored": {
			if (now < phase.until) return state;
			const next = state.arrowIndex + 1;
			if (next >= TOTAL_ARROWS) return withSounds$3({
				...state,
				arrowIndex: next,
				phase: { kind: "done" }
			}, "end");
			return prepareArrow(state, next, now);
		}
		case "done": return state;
	}
}
function aimBy(state, dx, dy) {
	if (state.phase.kind !== "drawing") return state;
	const limit = viewHalfSize(currentDistance(state));
	const clamp = (v) => Math.min(Math.max(v, -limit), limit);
	return {
		...state,
		aim: {
			x: clamp(state.aim.x + dx),
			y: clamp(state.aim.y + dy)
		}
	};
}
function roundReducer(state, action) {
	switch (action.type) {
		case "tick": return tick$3({
			...state,
			now: action.now
		});
		case "press":
			if (state.phase.kind !== "ready") return state;
			return withSounds$3({
				...state,
				phase: {
					kind: "drawing",
					startedAt: action.at
				}
			}, "draw");
		case "aimBy": return aimBy(state, action.dx, action.dy);
		case "release": return fire(state, action.at);
	}
}
function summarizeRound(state) {
	return {
		t0: state.t0,
		shots: state.shots,
		...totalOf$1(state.shots.map((s) => s.score))
	};
}
//#endregion
//#region src/server/games/archery.ts
const isNum$2 = (x) => typeof x === "number" && Number.isFinite(x);
/** 놓은 시각이 자동 발사·시간 끝보다 이만큼 늦어도 봐줌 (화면 한 프레임) */
const SLACK_MS = 50;
function readShots(x) {
	if (!Array.isArray(x) || x.length !== TOTAL_ARROWS) return null;
	const out = [];
	for (const s of x) {
		if (!s || typeof s !== "object") return null;
		const aim = s.aim;
		if (!aim || !isNum$2(aim.x) || !isNum$2(aim.y)) return null;
		const pressAt = s.pressAt === null ? null : isNum$2(s.pressAt) ? s.pressAt : void 0;
		const releaseAt = s.releaseAt === null ? null : isNum$2(s.releaseAt) ? s.releaseAt : void 0;
		if (pressAt === void 0 || releaseAt === void 0 || pressAt === null !== (releaseAt === null)) return null;
		if (pressAt !== null && releaseAt !== null && (releaseAt < pressAt || releaseAt - pressAt > 10050)) return null;
		out.push({
			pressAt,
			releaseAt,
			aim: {
				x: aim.x,
				y: aim.y
			}
		});
	}
	return out;
}
function replayArchery(seed, t0, shotsIn) {
	const shots = readShots(shotsIn);
	if (!shots || !isNum$2(t0)) return null;
	let s = createRound(t0, seed);
	let t = t0;
	const end = t0 + TOTAL_ARROWS * 16e3;
	while (s.phase.kind !== "done") {
		if (t > end) return null;
		const log = shots[s.arrowIndex];
		const { phase } = s;
		if (phase.kind === "ready" && log.pressAt !== null && log.pressAt <= t + 1) {
			if (s.deadline !== null && log.pressAt > s.deadline + SLACK_MS) return null;
			t = Math.max(t, log.pressAt);
			s = roundReducer({
				...s,
				now: t
			}, {
				type: "press",
				at: log.pressAt
			});
			s = roundReducer(s, {
				type: "aimBy",
				dx: log.aim.x,
				dy: log.aim.y
			});
			continue;
		}
		if (phase.kind === "drawing") {
			const at = log.releaseAt;
			if (s.deadline !== null && at > s.deadline + SLACK_MS) return null;
			t = Math.max(t, at);
			s = roundReducer({
				...s,
				now: t
			}, {
				type: "release",
				at
			});
			continue;
		}
		t += 1;
		s = roundReducer(s, {
			type: "tick",
			now: t
		});
	}
	const sum = summarizeRound(s);
	return {
		points: sum.points,
		xCount: sum.xCount,
		tenCount: sum.tenCount
	};
}
//#endregion
//#region src/games/batting/constants.ts
/**
* 타이밍 구간(일반, |터치 시각 − 도착 시각|).
* fair 안이면 앞으로 날아가고(가까울수록 멀리), foul 안이면 파울, 밖이면 헛스윙.
* perfect는 '딱 맞았어요' 표시용
*/
const TIMING_MS = {
	perfect: 20,
	fair: 130,
	foul: 180
};
/** 어려움은 모든 구간 폭을 이 비율로 줄인다 */
const HARD_WINDOW_SCALE = .7;
//#endregion
//#region src/games/batting/rules/judge.ts
const CELLS = [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9
];
/** 칸의 열(0=왼쪽)과 행(0=위) */
function cellPosition(cell) {
	return {
		col: (cell - 1) % 3,
		row: Math.floor((cell - 1) / 3)
	};
}
function cellMiddle(cell) {
	const { col, row } = cellPosition(cell);
	return {
		col: col + .5,
		row: row + .5
	};
}
/** 가장 가까운 정수. 딱 절반(칸 경계)이면 0 쪽(더 좋은 판정)으로 */
function roundLenient(v) {
	return Math.sign(v) * Math.max(0, Math.ceil(Math.abs(v) - .5));
}
/**
* 배트는 타자 쪽에 손잡이, 터치한 칸에 스윗스팟이 있고 그 너머로는 짧다.
* 우타는 왼쪽에 서서 오른쪽으로 휘두르니, 공이 터치보다 왼쪽이면 손잡이 쪽, 오른쪽이면 배트 끝 너머.
*/
function contactAt(hand, touch, ball) {
	const awaySign = hand === "right" ? 1 : -1;
	/** +면 배트 끝 너머, -면 손잡이 쪽 (칸 수) */
	const along = roundLenient((ball.col - touch.col) * awaySign);
	const vertical = Math.abs(roundLenient(ball.row - touch.row));
	if (along > 0) return "miss";
	if (along === 0 && vertical === 0) return "sweet";
	if (along === -1 && vertical === 0 || along === 0 && vertical === 1) return "off";
	if (along === -2 && vertical === 0 || along === -1 && vertical === 1) return "graze";
	return "miss";
}
/** 비거리별 결과 (멀리 간 것부터) */
const DISTANCE_TIERS = [
	{
		min: 115,
		outcome: "homerun"
	},
	{
		min: 95,
		outcome: "triple"
	},
	{
		min: 70,
		outcome: "double"
	},
	{
		min: 30,
		outcome: "single"
	},
	{
		min: 0,
		outcome: "out"
	}
];
function outcomeByDistance(distance) {
	return DISTANCE_TIERS.find((t) => distance >= t.min).outcome;
}
/** 빗맞으면 힘이 이만큼만 실린다 (완벽한 타이밍이어도 3루타 정도까지) */
const OFF_POWER = .65;
/** 정타라도 공 가운데에서 1칸 벗어날 때마다 힘이 이만큼 줄어든다 */
const SWEET_FALLOFF = .2;
/** 힘 → 비거리 곡선. 1보다 작으면 조금만 맞아도 꽤 날아간다 */
const DISTANCE_CURVE = .8;
function timingWindows(difficulty) {
	const scale = difficulty === "hard" ? HARD_WINDOW_SCALE : 1;
	return {
		perfect: TIMING_MS.perfect * scale,
		fair: TIMING_MS.fair * scale,
		foul: TIMING_MS.foul * scale
	};
}
function judgeSwing$1(opts) {
	const ball = cellMiddle(opts.ball);
	const contact = contactAt(opts.hand, opts.touch, ball);
	const offsetMs = opts.swingAt - opts.arriveAt;
	const windows = timingWindows(opts.difficulty);
	const diff = Math.abs(offsetMs);
	if (contact === "miss" || diff > windows.foul) return {
		outcome: "whiff",
		contact,
		offsetMs,
		distance: null
	};
	if (contact === "graze" || diff > windows.fair) return {
		outcome: "foul",
		contact,
		offsetMs,
		distance: null
	};
	const timing = 1 - diff / windows.fair;
	const miss = Math.hypot(ball.col - opts.touch.col, ball.row - opts.touch.row);
	const power = timing * (contact === "sweet" ? Math.max(0, 1 - SWEET_FALLOFF * miss) : OFF_POWER);
	const distance = Math.round(15 + 125 * power ** DISTANCE_CURVE);
	return {
		outcome: outcomeByDistance(distance),
		contact,
		offsetMs,
		distance
	};
}
//#endregion
//#region src/games/batting/rules/scoring.ts
const HITS = [
	"homerun",
	"triple",
	"double",
	"single"
];
function isHit(outcome) {
	return HITS.includes(outcome);
}
/** 공 하나의 점수 */
function pointsOf(r) {
	return r.distance ?? 0;
}
function totalOf(records) {
	return {
		points: records.reduce((sum, r) => sum + pointsOf(r), 0),
		homeruns: records.filter((r) => r.outcome === "homerun").length,
		hits: records.filter((r) => isHit(r.outcome)).length
	};
}
//#endregion
//#region src/games/batting/play/battedBall.ts
const GRAVITY = 9.8;
/** 결과별 띄우는 각도(도). 범타는 땅볼 */
const LAUNCH_DEG = {
	homerun: [27, 32],
	triple: [20, 24],
	double: [15, 19],
	single: [8, 12]
};
/** 길게 날아가도 이만큼만 보여준다 */
const MAX_SHOW_MS = 2200;
/** 페어 타구의 최대 좌우 각도 */
const MAX_FAIR_ANGLE = 38 * Math.PI / 180;
function within$1(rng, [min, max]) {
	return min + rng.next() * (max - min);
}
function createBattedBall$1(opts) {
	const { outcome, contact, hand, offsetMs, distance, foulWindowMs, start, startAt, rng } = opts;
	if (outcome === "whiff" || outcome === "looking") return null;
	/** 우타 기준 +면 밀어 친 쪽(오른쪽) */
	const handSign = hand === "right" ? 1 : -1;
	const lateness = Math.max(-1, Math.min(1, offsetMs / foulWindowMs));
	if (outcome === "foul" || distance === null) {
		if (contact === "graze") return {
			startAt,
			duration: 1100,
			start,
			velocity: {
				x: (rng.next() - .5) * 4,
				y: within$1(rng, [11, 14]),
				z: within$1(rng, [-9, -6])
			}
		};
		const angle = Math.sign(lateness || 1) * handSign * within$1(rng, [55, 72]) * Math.PI / 180;
		const speed = within$1(rng, [22, 28]);
		return {
			startAt,
			duration: 1300,
			start,
			velocity: {
				x: Math.sin(angle) * speed,
				y: within$1(rng, [6, 10]),
				z: Math.cos(angle) * speed
			}
		};
	}
	const spray = lateness * handSign * MAX_FAIR_ANGLE + (rng.next() - .5) * .1;
	if (outcome === "out") {
		const forward = distance / 1.2;
		return {
			startAt,
			duration: 1200,
			start,
			velocity: {
				x: Math.sin(spray) * forward,
				y: -3,
				z: Math.cos(spray) * forward
			}
		};
	}
	const launch = within$1(rng, LAUNCH_DEG[outcome]) * Math.PI / 180;
	const speed = Math.sqrt(distance * GRAVITY / Math.sin(2 * launch));
	const forward = speed * Math.cos(launch);
	const flightMs = 2 * speed * Math.sin(launch) / GRAVITY * 1e3;
	return {
		startAt,
		duration: Math.min(MAX_SHOW_MS, flightMs + 300),
		start,
		velocity: {
			x: Math.sin(spray) * forward,
			y: speed * Math.sin(launch),
			z: Math.cos(spray) * forward
		}
	};
}
function battedBallEndAt$1(ball) {
	return ball.startAt + ball.duration;
}
//#endregion
//#region src/games/batting/play/pitch.ts
const PITCH_TYPES = [
	"fastball",
	"slider",
	"curve"
];
/** 스트라이크 존(m). 한 칸은 가로 0.2 × 세로 0.28 (위아래가 잘 구분되게 세로를 길게) */
const ZONE = {
	left: -.3,
	right: .3,
	bottom: .45,
	top: 1.29
};
const CELL_WIDTH = (ZONE.right - ZONE.left) / 3;
const CELL_HEIGHT = (ZONE.top - ZONE.bottom) / 3;
/** 우완 투수가 공을 놓는 곳 (포수 시점 왼쪽 위) */
const RELEASE = {
	x: -.45,
	y: 1.8,
	z: 17
};
/** 포수 미트. 공이 홈을 지나 여기서 멈춘다 */
const MITT_Z = -1.1;
/** 구종별 비행 시간(놓은 순간 → 홈 도착) */
const FLIGHT_MS$1 = {
	normal: {
		fastball: 620,
		slider: 710,
		curve: 820
	},
	hard: {
		fastball: 510,
		slider: 590,
		curve: 680
	}
};
/**
* 궤적의 휨. break는 휘는 총량(m)과 방향, power가 클수록 홈 근처에서 늦게 휜다.
* 위치 = 직선(놓은 곳 → 도착 칸) + break × (s^power − s). 처음과 끝은 직선과 같고 그 사이가 볼록해진다.
*/
const SHAPE = {
	fastball: {
		breakX: 0,
		breakY: -.12,
		power: 2
	},
	slider: {
		breakX: .75,
		breakY: -.2,
		power: 3
	},
	curve: {
		breakX: .35,
		breakY: -1.5,
		power: 2.4
	}
};
/** 칸 가운데(공이 도착하는 곳) */
function cellCenter(cell) {
	const { col, row } = cellPosition(cell);
	return {
		x: ZONE.left + CELL_WIDTH * (col + .5),
		y: ZONE.top - CELL_HEIGHT * (row + .5)
	};
}
function createPitch$1(rng, difficulty, releaseAt) {
	const type = pickOne(rng, PITCH_TYPES);
	const cell = pickOne(rng, CELLS);
	const jitter = (rng.next() * 2 - 1) * 25;
	return {
		type,
		cell,
		releaseAt,
		arriveAt: releaseAt + FLIGHT_MS$1[difficulty][type] + jitter
	};
}
/** 진행도 s(0=놓음, 1=홈 도착)의 위치 */
function pathAt(pitch, s) {
	const end = cellCenter(pitch.cell);
	const { breakX, breakY, power } = SHAPE[pitch.type];
	const bend = s ** power - s;
	return {
		x: RELEASE.x + (end.x - RELEASE.x) * s + breakX * bend,
		y: RELEASE.y + (end.y - RELEASE.y) * s + breakY * bend,
		z: RELEASE.z * (1 - s)
	};
}
/** 시각 t의 공 위치. 놓기 전이면 null. 홈을 지난 뒤엔 그 방향 그대로 미트까지 가서 멈춘다 */
function ballPosition(pitch, t) {
	if (t < pitch.releaseAt) return null;
	const s = (t - pitch.releaseAt) / (pitch.arriveAt - pitch.releaseAt);
	if (s <= 1) return pathAt(pitch, s);
	const end = pathAt(pitch, 1);
	const before = pathAt(pitch, .99);
	const maxK = (end.z - MITT_Z) / (before.z - end.z);
	const k = Math.min((s - 1) / .01, maxK);
	return {
		x: end.x + (end.x - before.x) * k,
		y: end.y + (end.y - before.y) * k,
		z: end.z + (end.z - before.z) * k
	};
}
function pitchEndAt$1(pitch) {
	return pitch.arriveAt + 320;
}
//#endregion
//#region src/games/batting/play/session.ts
const FIRST_READY_MS = 1200;
/** 공과 공 사이 쉬는 시간 */
const READY_MS = 1500;
/** 결과를 보여주는 최소 시간 */
const RESULT_MS$1 = 1800;
/** 마지막 공 뒤 '경기 끝'을 보여주고 결과 화면으로 넘어가기까지 */
const DONE_MS$1 = 1800;
function withSounds$2(state, ...names) {
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
function createSession(opts) {
	return {
		now: opts.now,
		seed: opts.seed,
		difficulty: opts.difficulty,
		hand: opts.hand,
		index: 0,
		records: [],
		phase: {
			kind: "ready",
			until: opts.now + FIRST_READY_MS
		},
		sounds: [],
		soundSeq: 0
	};
}
function startWindup(state) {
	const rng = createRng(state.seed);
	const releaseAt = state.now + 900;
	const pitch = createPitch$1(rng, state.difficulty, releaseAt);
	return {
		...state,
		seed: rng.seed(),
		phase: {
			kind: "windup",
			pitch,
			until: releaseAt
		}
	};
}
function hitSound(record) {
	if (record.outcome === "homerun") return ["hit", "homerun"];
	if (record.contact === "sweet") return ["hit"];
	return ["weak"];
}
/** 결과 단계로. 친 공이면 타구 비행을 만든다 */
function showResult(state, pitch, swing, record) {
	const rng = createRng(state.seed);
	const batted = swing && record.contact && record.offsetMs !== null ? createBattedBall$1({
		outcome: record.outcome,
		contact: record.contact,
		hand: state.hand,
		offsetMs: record.offsetMs,
		distance: record.distance,
		foulWindowMs: timingWindows(state.difficulty).foul,
		start: ballPosition(pitch, swing.at) ?? {
			x: 0,
			y: 1,
			z: 0
		},
		startAt: swing.at,
		rng
	}) : null;
	const until = Math.max(state.now + RESULT_MS$1, batted ? battedBallEndAt$1(batted) : 0);
	return {
		...state,
		seed: rng.seed(),
		records: [...state.records, record],
		phase: {
			kind: "result",
			pitch,
			swing,
			record,
			batted,
			until
		}
	};
}
function swing$1(state, point, at) {
	const { phase } = state;
	if (phase.kind !== "pitching" || phase.swing) return state;
	const { pitch } = phase;
	const result = judgeSwing$1({
		difficulty: state.difficulty,
		hand: state.hand,
		touch: point,
		ball: pitch.cell,
		swingAt: at,
		arriveAt: pitch.arriveAt
	});
	const record = {
		index: state.index,
		pitch,
		touched: point,
		...result
	};
	const s = {
		point,
		at
	};
	if (result.outcome === "whiff") return withSounds$2({
		...state,
		phase: {
			...phase,
			swing: s,
			record
		}
	}, "whiff");
	return withSounds$2(showResult(state, pitch, s, record), ...hitSound(record));
}
function tick$2(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "ready": return now >= phase.until ? startWindup(state) : state;
		case "windup":
			if (now < phase.until) return state;
			return withSounds$2({
				...state,
				phase: {
					kind: "pitching",
					pitch: phase.pitch,
					swing: null,
					record: null
				}
			}, "pitch");
		case "pitching": {
			if (now < pitchEndAt$1(phase.pitch)) return state;
			const record = phase.record ?? {
				index: state.index,
				pitch: phase.pitch,
				touched: null,
				outcome: "looking",
				contact: null,
				offsetMs: null,
				distance: null
			};
			return withSounds$2(showResult(state, phase.pitch, phase.swing, record), "mitt");
		}
		case "result": {
			if (now < phase.until) return state;
			const next = state.index + 1;
			if (next >= 10) return withSounds$2({
				...state,
				index: next,
				phase: {
					kind: "done",
					until: now + DONE_MS$1
				}
			}, "end");
			return {
				...state,
				index: next,
				phase: {
					kind: "ready",
					until: now + READY_MS
				}
			};
		}
		case "done": return state;
	}
}
function sessionReducer(state, action) {
	switch (action.type) {
		case "tick": return tick$2({
			...state,
			now: action.now
		});
		case "swing": return swing$1(state, action.point, action.at);
	}
}
function summarizeSession(state) {
	return {
		difficulty: state.difficulty,
		hand: state.hand,
		records: state.records,
		...totalOf(state.records)
	};
}
//#endregion
//#region src/server/games/batting.ts
const isNum$1 = (x) => typeof x === "number" && Number.isFinite(x);
function readSwings(x) {
	if (!Array.isArray(x) || x.length !== 10) return null;
	const out = [];
	for (const s of x) {
		if (s === null) {
			out.push(null);
			continue;
		}
		const o = s;
		const p = o?.point;
		if (!p || !isNum$1(p.col) || !isNum$1(p.row) || Math.abs(p.col - 1) > 3 || Math.abs(p.row - 1) > 3 || !isNum$1(o.offsetMs) || Math.abs(o.offsetMs) > 5e3) return null;
		out.push({
			point: {
				col: p.col,
				row: p.row
			},
			offsetMs: o.offsetMs
		});
	}
	return out;
}
function replayBatting(seed, difficulty, hand, swingsIn) {
	if (difficulty !== "normal" && difficulty !== "hard" || hand !== "right" && hand !== "left") return null;
	const swings = readSwings(swingsIn);
	if (!swings) return null;
	let s = createSession({
		now: 0,
		seed,
		difficulty,
		hand
	});
	let t = 0;
	while (s.phase.kind !== "done") {
		if (t > 6e5) return null;
		const { phase } = s;
		const log = swings[s.index];
		if (phase.kind === "pitching" && !phase.swing && log) {
			const at = phase.pitch.arriveAt + log.offsetMs;
			if (at < phase.pitch.releaseAt) return null;
			if (t + 1 >= at) {
				s = sessionReducer({
					...s,
					now: Math.max(t, at)
				}, {
					type: "swing",
					point: log.point,
					at
				});
				if (s.phase.kind === "pitching" && !s.phase.swing) return null;
				continue;
			}
		}
		t += 1;
		s = sessionReducer(s, {
			type: "tick",
			now: t
		});
	}
	if (s.records.filter((r) => r.touched !== null).length !== swings.filter(Boolean).length) return null;
	const sum = summarizeSession(s);
	return {
		difficulty,
		hand,
		points: sum.points,
		homeruns: sum.homeruns,
		hits: sum.hits
	};
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
function withSounds$1(state, ...names) {
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
function createMatch$1(opts) {
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
function startChoosing$1(state) {
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
	return withSounds$1({
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
function tick$1(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "intro": return now >= phase.until && !state.follow ? startChoosing$1(state) : state;
		case "choosing": return now >= phase.until && !state.follow ? reveal(state, phase.picks) : state;
		case "reveal": {
			if (now < phase.until) return state;
			const winner = winnerOf(state.fighters, state.turns.length);
			if (winner === null) return state.follow ? state : startChoosing$1(state);
			const userSide = state.controllers.indexOf("user");
			return withSounds$1({
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
	return withSounds$1({
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
	return startChoosing$1(state);
}
function remoteReveal(state, turn, stances) {
	if (!state.follow || turn !== state.turns.length) return state;
	const { kind } = state.phase;
	if (kind !== "choosing" && kind !== "intro" && kind !== "reveal") return state;
	return reveal(state, stances);
}
function matchReducer$1(state, action) {
	switch (action.type) {
		case "tick": return tick$1({
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
	let s = createMatch$1({
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
			s = matchReducer$1(s, {
				type: "pick",
				side: 0,
				stance: move
			});
			if (((s.phase.kind === "choosing" ? s.phase.picks[0] : null) ?? "ready") !== move) return null;
		}
		s = matchReducer$1(s, {
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
//#region src/games/zolaball/rules/judge.ts
/** 스윙 결과. 좋은 것부터 나쁜 것 순서. */
const SWING_RESULTS = [
	"homerun",
	"double",
	"single",
	"out",
	"foul",
	"miss"
];
/** 일반 난이도 기준 판정 구간 (공 도착과 스윙 시점 차이의 절댓값, ms 이하). */
const WINDOWS = [
	[15, "homerun"],
	[30, "double"],
	[55, "single"],
	[85, "out"],
	[130, "foul"]
];
/** 난이도별 구간 폭(%). 85 × 0.7 같은 소수 곱의 부동소수점 오차를 피하려고 정수 백분율로 계산한다. */
const WINDOW_PERCENT = {
	normal: 100,
	hard: 70
};
function judgeSwing({ diffMs, difficulty, pitchIsBall }) {
	if (pitchIsBall) return "miss";
	const percent = WINDOW_PERCENT[difficulty];
	const abs = Math.abs(diffMs);
	const hit = WINDOWS.find(([max]) => abs * 100 <= max * percent);
	return hit ? hit[1] : "miss";
}
/**
* 일반 난이도에서 주어진 결과가 나오는 스윙 시각 차이(ms)를 하나 고른다. 봇 타자가 쓴다.
* random은 0 이상 1 미만 값을 돌려주는 함수.
*/
function diffForResult(result, random) {
	const i = SWING_RESULTS.indexOf(result);
	const min = i === 0 ? 0 : WINDOWS[i - 1][0] + 1;
	const max = i < WINDOWS.length ? WINDOWS[i][0] : 300;
	const abs = min + random() * (max - min);
	return random() < .5 ? -abs : abs;
}
//#endregion
//#region src/games/zolaball/bot/batterBot.ts
/**
* 스윙했을 때 결과 비율(%). '정타'는 배트에 제대로 맞아 페어가 된 타구(범타 이상)로 본다.
* 일반: 스트라이크에 80% 스윙 × 페어 62.5% ≈ 스트라이크의 50%가 정타.
*/
const NORMAL_WEIGHTS = {
	homerun: 6.25,
	double: 9.4,
	single: 21.85,
	out: 25,
	foul: 20,
	miss: 17.5
};
const HARD_WEIGHTS = {
	homerun: 7.8,
	double: 11.7,
	single: 22.75,
	out: 22.75,
	foul: 20,
	miss: 15
};
/** 지금 공과 같은 구종이 직전에 몇 번 연속으로 왔는지 (최대 2) */
function repeats(type, recentTypes) {
	let n = 0;
	for (let i = recentTypes.length - 1; i >= 0 && recentTypes[i] === type && n < 2; i--) n++;
	return n;
}
function swingChance(difficulty, pitch, count) {
	if (difficulty === "normal") return pitch.isBall ? .45 : .8;
	if (pitch.isBall) return count.strikes === 2 ? .25 : .15;
	return .85;
}
/**
* 봇 타자의 스윙 결정.
* - 일반: 스트라이크에 약 50% 정타, 볼에도 자주 스윙
* - 어려움: 볼을 잘 참고, 같은 구종이 반복되면 더 잘 친다
* 볼에 스윙하면 판정(judgeSwing)에서 헛스윙이 된다.
*/
function botDecideSwing(difficulty, pitch, count, recentTypes, rng) {
	if (!chance(rng, swingChance(difficulty, pitch, count))) return { swing: false };
	let weights = difficulty === "normal" ? NORMAL_WEIGHTS : HARD_WEIGHTS;
	if (difficulty === "hard") {
		const r = repeats(pitch.type, recentTypes);
		if (r > 0) {
			const boost = 1 + .25 * r;
			weights = {
				homerun: weights.homerun * boost,
				double: weights.double * boost,
				single: weights.single * boost,
				out: weights.out,
				foul: weights.foul * (1 - .2 * r),
				miss: weights.miss * (1 - .35 * r)
			};
		}
	}
	return {
		swing: true,
		diffMs: diffForResult(pickWeighted(rng, weights), rng.next)
	};
}
//#endregion
//#region src/games/zolaball/bot/pitcherBot.ts
/** 어려움: 볼카운트에 따라 스트라이크를 던질 확률 */
function hardStrikeChance({ balls, strikes }) {
	if (balls === 3) return .75;
	if (strikes === 2) return .3;
	if (balls > strikes) return .6;
	return .5;
}
/**
* 봇 투수의 투구 선택.
* - 일반: 무작위, 스트라이크 약 50%
* - 어려움: 볼카운트를 보고 스트라이크/볼을 정하고, 같은 구종이 반복되지 않게 섞는다
* recentTypes는 최근 투구 구종(마지막이 가장 최근).
*/
function botChoosePitch(difficulty, count, recentTypes, rng) {
	const height = pickOne(rng, ["high", "low"]);
	if (difficulty === "normal") return {
		type: pickOne(rng, ["fastball", "breaking"]),
		isBall: !chance(rng, .5),
		height
	};
	const [prev2, prev1] = recentTypes.slice(-2);
	let type;
	if (prev1 && prev1 === prev2) {
		const other = prev1 === "fastball" ? "breaking" : "fastball";
		type = chance(rng, .75) ? other : prev1;
	} else type = chance(rng, .45) ? "breaking" : "fastball";
	return {
		type,
		isBall: !chance(rng, hardStrikeChance(count)),
		height
	};
}
//#endregion
//#region src/games/zolaball/constants.ts
const STANDS_STEP_DEPTH = 3.5;
const STANDS_STEP_RISE = 3.2;
//#endregion
//#region src/games/zolaball/play/battedBall.ts
const PROFILES = {
	foul: {
		distance: [-28, -12],
		apex: [10, 18],
		duration: [900, 1100]
	},
	out: {
		distance: [45, 95],
		apex: [24, 34],
		duration: [1500, 1800]
	},
	single: {
		distance: [35, 65],
		apex: [3, 7],
		duration: [800, 1e3]
	},
	double: {
		distance: [75, 105],
		apex: [12, 20],
		duration: [1300, 1500]
	},
	homerun: {
		distance: [128, 152],
		apex: [26, 38],
		duration: [2e3, 2300]
	}
};
function within(rng, [min, max]) {
	return min + rng.next() * (max - min);
}
/** x 위치의 관중석 높이 (관중석 밖이면 0) */
function standsHeightAt(x) {
	if (x < 124) return 0;
	return Math.min(Math.floor((x - 124) / STANDS_STEP_DEPTH) + 1, 10) * STANDS_STEP_RISE;
}
function createBattedBall(kind, start, startAt, rng) {
	const p = PROFILES[kind];
	const landX = within(rng, p.distance);
	return {
		kind,
		startAt,
		duration: within(rng, p.duration),
		start,
		end: {
			x: landX,
			y: standsHeightAt(landX)
		},
		apex: within(rng, p.apex)
	};
}
function battedBallEndAt(ball) {
	return ball.startAt + ball.duration;
}
//#endregion
//#region src/games/zolaball/play/pitch.ts
/** 스트라이크 존(m). 졸라맨(키 3m) 기준 무릎~가슴. 필드에 그려서 볼/스트라이크를 구분할 수 있게 한다. */
const STRIKE_ZONE = {
	bottom: .8,
	top: 1.9
};
const FLIGHT_MS = {
	fastball: 400,
	breaking: 525
};
const PLATE_HEIGHT = {
	fastball: {
		strike: {
			high: 1.7,
			low: 1
		},
		ball: {
			high: 2.45,
			low: .4
		}
	},
	breaking: {
		strike: {
			high: 1.7,
			low: 1
		},
		ball: {
			high: 2.4,
			low: .3
		}
	}
};
/** 높은 공은 조금 빨리, 낮은 공은 조금 늦게 도착한다. 존 가운데에서 1m 벗어날 때마다 이만큼. */
const ARRIVAL_SHIFT_MS_PER_M = 30;
function createPitch(call, releaseAt) {
	const plateHeight = PLATE_HEIGHT[call.type][call.isBall ? "ball" : "strike"][call.height];
	const shift = -(plateHeight - (STRIKE_ZONE.top + STRIKE_ZONE.bottom) / 2) * ARRIVAL_SHIFT_MS_PER_M;
	return {
		...call,
		releaseAt,
		arriveAt: releaseAt + FLIGHT_MS[call.type] + shift,
		plateHeight
	};
}
function pitchEndAt(pitch) {
	return pitch.arriveAt + 300;
}
const PITCH_KEYS = [
	1,
	2,
	3,
	4
];
const PITCH_KEY_INFO = {
	1: {
		type: "fastball",
		isBall: false,
		label: "직구 스트라이크"
	},
	2: {
		type: "fastball",
		isBall: true,
		label: "직구 볼"
	},
	3: {
		type: "breaking",
		isBall: false,
		label: "변화구 스트라이크"
	},
	4: {
		type: "breaking",
		isBall: true,
		label: "변화구 볼"
	}
};
const EMPTY_SELECTION = {
	key: null,
	height: null
};
function isSelectionComplete(sel) {
	return sel.key !== null && sel.height !== null;
}
/** 고르지 않은 항목은 무작위로 채워 투구를 확정한다. */
function completeSelection(sel, rng) {
	const key = sel.key ?? pickOne(rng, PITCH_KEYS);
	const height = sel.height ?? pickOne(rng, ["high", "low"]);
	const { type, isBall } = PITCH_KEY_INFO[key];
	return {
		type,
		isBall,
		height
	};
}
const EMPTY_BASES = [
	false,
	false,
	false
];
function emptyStats() {
	return {
		atBats: 0,
		hits: 0,
		homeruns: 0,
		strikeouts: 0,
		walks: 0,
		rbi: 0
	};
}
function emptyPitching() {
	return {
		outs: 0,
		runsAllowed: 0
	};
}
function createGame() {
	return {
		inning: 1,
		half: "top",
		outs: 0,
		balls: 0,
		strikes: 0,
		bases: EMPTY_BASES,
		linescore: {
			away: [0],
			home: []
		},
		stats: {
			away: emptyStats(),
			home: emptyStats()
		},
		pitching: {
			away: emptyPitching(),
			home: emptyPitching()
		},
		final: false
	};
}
function battingSide(half) {
	return half === "top" ? "away" : "home";
}
function fieldingSide(half) {
	return half === "top" ? "home" : "away";
}
function totalRuns(game, side) {
	return game.linescore[side].reduce((a, b) => a + b, 0);
}
/** 모든 주자와 타자가 n베이스씩 진루. 홈을 밟은 수를 돌려준다. */
function advance(bases, n) {
	const next = [
		false,
		false,
		false
	];
	let runs = 0;
	bases.forEach((occupied, i) => {
		if (!occupied) return;
		if (i + n >= 3) runs++;
		else next[i + n] = true;
	});
	if (n >= 4) runs++;
	else next[n - 1] = true;
	return [next, runs];
}
/** 볼넷: 1루부터 꽉 찬 베이스만 밀려서 진루 */
function walk(bases) {
	const [first, second, third] = bases;
	if (!first) return [[
		true,
		second,
		third
	], 0];
	if (!second) return [[
		true,
		true,
		third
	], 0];
	if (!third) return [[
		true,
		true,
		true
	], 0];
	return [[
		true,
		true,
		true
	], 1];
}
function applyPitch(game, outcome) {
	if (game.final) throw new Error("경기가 이미 끝났습니다");
	let { balls, strikes, outs, bases } = game;
	let runs = 0;
	let plateResult = null;
	switch (outcome) {
		case "ball":
			balls++;
			if (balls === 4) {
				[bases, runs] = walk(bases);
				plateResult = "walk";
			}
			break;
		case "calledStrike":
		case "swingingStrike":
			strikes++;
			if (strikes === 3) {
				outs++;
				plateResult = "strikeout";
			}
			break;
		case "foul":
			if (strikes < 2) strikes++;
			break;
		case "out":
			outs++;
			plateResult = "out";
			break;
		case "single":
			[bases, runs] = advance(bases, 1);
			plateResult = "single";
			break;
		case "double":
			[bases, runs] = advance(bases, 2);
			plateResult = "double";
			break;
		case "homerun":
			[bases, runs] = advance(bases, 4);
			plateResult = "homerun";
	}
	if (plateResult) {
		balls = 0;
		strikes = 0;
	}
	const side = battingSide(game.half);
	const stats = { ...game.stats[side] };
	if (plateResult === "walk") stats.walks++;
	else if (plateResult) stats.atBats++;
	if (plateResult === "single" || plateResult === "double" || plateResult === "homerun") stats.hits++;
	if (plateResult === "homerun") stats.homeruns++;
	if (plateResult === "strikeout") stats.strikeouts++;
	stats.rbi += runs;
	const defense = fieldingSide(game.half);
	const pitching = {
		outs: game.pitching[defense].outs + (outs - game.outs),
		runsAllowed: game.pitching[defense].runsAllowed + runs
	};
	const sideLine = [...game.linescore[side]];
	sideLine[game.inning - 1] += runs;
	let next = {
		...game,
		balls,
		strikes,
		outs,
		bases,
		linescore: {
			...game.linescore,
			[side]: sideLine
		},
		stats: {
			...game.stats,
			[side]: stats
		},
		pitching: {
			...game.pitching,
			[defense]: pitching
		}
	};
	const lastInning = game.inning >= 2;
	const homeLeads = () => totalRuns(next, "home") > totalRuns(next, "away");
	let halfEnded = false;
	if (game.half === "bottom" && lastInning && homeLeads()) next = {
		...next,
		final: true
	};
	else if (outs >= 3) {
		halfEnded = true;
		const cleared = {
			...next,
			outs: 0,
			balls: 0,
			strikes: 0,
			bases: EMPTY_BASES
		};
		if (game.half === "top") next = lastInning && homeLeads() ? {
			...cleared,
			final: true
		} : {
			...cleared,
			half: "bottom",
			linescore: {
				...cleared.linescore,
				home: [...cleared.linescore.home, 0]
			}
		};
		else next = lastInning ? {
			...cleared,
			final: true
		} : {
			...cleared,
			inning: game.inning + 1,
			half: "top",
			linescore: {
				...cleared.linescore,
				away: [...cleared.linescore.away, 0]
			}
		};
	}
	return {
		game: next,
		event: {
			outcome,
			plateResult,
			runs,
			halfEnded,
			gameEnded: next.final
		}
	};
}
//#endregion
//#region src/games/zolaball/match/matchState.ts
const ANNOUNCE_MS = 1600;
const BOT_THINK_MS = [700, 1500];
const BOT_WINDUP_MS = [300, 800];
const USER_WINDUP_MS = 250;
const MITT_DELAY_MS = 40;
const RESULT_MS = 1100;
/** 타구가 떨어진 뒤 결과를 더 보여주는 시간 */
const AFTER_LANDING_MS = 700;
const PLATE_RESULT_MS = 1600;
const HOMERUN_MS = 2400;
const FINAL_MS = 2200;
function controllerOf(config, side) {
	return side === config.userSide ? "user" : config.opponent ?? "bot";
}
function pitcherOf(state) {
	return controllerOf(state.config, fieldingSide(state.game.half));
}
function batterOf(state) {
	return controllerOf(state.config, battingSide(state.game.half));
}
function isUserBatting(state) {
	return controllerOf(state.config, battingSide(state.game.half)) === "user";
}
function isUserPitching(state) {
	return controllerOf(state.config, fieldingSide(state.game.half)) === "user";
}
function createMatch(config, now, seed) {
	return {
		config,
		game: createGame(),
		phase: {
			kind: "announce",
			until: now + ANNOUNCE_MS
		},
		now,
		seed,
		swingAt: null,
		recentTypes: [],
		pitchCount: 0,
		pendingPitch: null,
		sounds: [],
		soundSeq: 0,
		inputs: []
	};
}
function withSounds(state, ...names) {
	if (names.length === 0) return state;
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
function between(random, [min, max]) {
	return min + random * (max - min);
}
function startChoosing(state, now) {
	const rng = createRng(state.seed);
	const botPitchAt = now + between(rng.next(), BOT_THINK_MS);
	const next = {
		...state,
		seed: rng.seed(),
		phase: {
			kind: "choosing",
			startedAt: now,
			selection: EMPTY_SELECTION,
			botPitchAt
		}
	};
	const pending = state.pendingPitch;
	if (pending && pending.n === state.pitchCount && pitcherOf(state) === "remote") return throwPitch(next, pending.call, pending.windupMs);
	return next;
}
function throwPitch(state, call, windupMs) {
	const rng = createRng(state.seed);
	const windup = windupMs ?? (isUserPitching(state) ? USER_WINDUP_MS : between(rng.next(), BOT_WINDUP_MS));
	const pitch = createPitch(call, state.now + windup);
	const { balls, strikes } = state.game;
	const botSwing = batterOf(state) === "bot" ? botDecideSwing(state.config.difficulty, call, {
		balls,
		strikes
	}, state.recentTypes, rng) : null;
	return {
		...state,
		seed: rng.seed(),
		recentTypes: [...state.recentTypes, call.type].slice(-3),
		pitchCount: state.pitchCount + 1,
		pendingPitch: null,
		phase: {
			kind: "pitching",
			pitch,
			botSwing,
			swing: null,
			released: false,
			caught: false,
			remoteOutcome: null
		}
	};
}
function outcomeOf(pitch, swing) {
	if (!swing) return pitch.isBall ? "ball" : "calledStrike";
	return swing.result === "miss" ? "swingingStrike" : swing.result;
}
function resultDuration(event) {
	if (event.gameEnded) return FINAL_MS;
	if (event.plateResult === "homerun") return HOMERUN_MS;
	if (event.plateResult) return PLATE_RESULT_MS;
	return RESULT_MS;
}
/** forced: 친구(타자)가 보낸 판정 */
function resolvePitch(state, contactAt, forced) {
	if (state.phase.kind !== "pitching") return state;
	const { pitch, swing } = state.phase;
	const outcome = forced ?? outcomeOf(pitch, swing);
	const { game, event } = applyPitch(state.game, outcome);
	const userDiffMs = swing && isUserBatting(state) ? swing.at - pitch.arriveAt : null;
	const inputs = isUserBatting(state) ? [...state.inputs, { diff: userDiffMs }] : state.inputs;
	const rng = createRng(state.seed);
	const batted = contactAt !== null && (outcome === "foul" || outcome === "out" || outcome === "single" || outcome === "double" || outcome === "homerun") ? createBattedBall(outcome, {
		x: 0,
		y: pitch.plateHeight
	}, contactAt, rng) : null;
	const until = Math.max(state.now + resultDuration(event), batted ? battedBallEndAt(batted) + AFTER_LANDING_MS : 0);
	const sounds = [];
	if (forced && outcome !== "ball" && outcome !== "calledStrike") sounds.push("swing");
	if (contactAt !== null) sounds.push(outcome === "foul" ? "foul" : outcome === "homerun" || outcome === "double" ? "crack" : "hit");
	else if (forced) sounds.push("mitt");
	if (event.plateResult === "homerun") sounds.push("fly", "cheer");
	if (event.plateResult === "strikeout") sounds.push("strikeout");
	if (event.plateResult === "walk") sounds.push("walk");
	if (event.gameEnded) sounds.push("gameEnd");
	return withSounds({
		...state,
		game,
		inputs,
		seed: rng.seed(),
		swingAt: forced && outcome !== "ball" && outcome !== "calledStrike" ? pitch.arriveAt - 60 : state.swingAt,
		phase: {
			kind: "result",
			until,
			event,
			pitch,
			userDiffMs,
			batted,
			outcome,
			contact: contactAt !== null
		}
	}, ...sounds);
}
function tick(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "announce": return now >= phase.until ? startChoosing(state, now) : state;
		case "choosing": {
			if (pitcherOf(state) === "remote") return state;
			if (isUserPitching(state)) {
				if (now < phase.startedAt + 5e3) return state;
				const rng = createRng(state.seed);
				const call = completeSelection(phase.selection, rng);
				return throwPitch({
					...state,
					seed: rng.seed(),
					inputs: [...state.inputs, { sel: phase.selection }]
				}, call);
			}
			if (now < phase.botPitchAt) return state;
			const rng = createRng(state.seed);
			const { balls, strikes } = state.game;
			const call = botChoosePitch(state.config.difficulty, {
				balls,
				strikes
			}, state.recentTypes, rng);
			return throwPitch({
				...state,
				seed: rng.seed()
			}, call);
		}
		case "pitching": {
			const { pitch, botSwing } = phase;
			let next = state;
			let p = phase;
			if (!p.released && now >= pitch.releaseAt) {
				p = {
					...p,
					released: true
				};
				next = withSounds({
					...next,
					phase: p
				}, "pitch");
			}
			if (batterOf(state) === "remote") {
				const r = p.remoteOutcome;
				if (!r || now < pitch.arriveAt) return next;
				return resolvePitch(next, r.contact ? pitch.arriveAt : null, r.outcome);
			}
			if (botSwing?.swing && !p.swing && now >= pitch.arriveAt + botSwing.diffMs) {
				const at = pitch.arriveAt + botSwing.diffMs;
				const result = judgeSwing({
					diffMs: botSwing.diffMs,
					difficulty: "normal",
					pitchIsBall: pitch.isBall
				});
				p = {
					...p,
					swing: {
						at,
						result
					}
				};
				next = withSounds({
					...next,
					phase: p,
					swingAt: at
				}, "swing");
			}
			const contact = p.swing !== null && p.swing.result !== "miss";
			if (contact && now >= pitch.arriveAt) return resolvePitch(next, pitch.arriveAt);
			if (!contact && !p.caught && now >= pitch.arriveAt + MITT_DELAY_MS) {
				p = {
					...p,
					caught: true
				};
				next = withSounds({
					...next,
					phase: p
				}, "mitt");
			}
			if (!contact && now >= pitchEndAt(pitch)) return resolvePitch(next, null);
			return next;
		}
		case "result":
			if (now < phase.until) return state;
			if (state.game.final) return {
				...state,
				phase: { kind: "final" }
			};
			if (phase.event.halfEnded) return {
				...state,
				phase: {
					kind: "announce",
					until: now + ANNOUNCE_MS
				}
			};
			return startChoosing(state, now);
		case "final": return state;
	}
}
function select(state, change) {
	const { phase } = state;
	if (phase.kind !== "choosing" || !isUserPitching(state)) return state;
	const selection = {
		...phase.selection,
		...change
	};
	if (!isSelectionComplete(selection)) return {
		...state,
		phase: {
			...phase,
			selection
		}
	};
	const rng = createRng(state.seed);
	return throwPitch({
		...state,
		seed: rng.seed(),
		inputs: [...state.inputs, { sel: selection }]
	}, completeSelection(selection, rng));
}
function remotePitch(state, pitch) {
	if (pitcherOf(state) !== "remote" || pitch.n !== state.pitchCount) return state;
	if (state.phase.kind === "choosing") return throwPitch(state, pitch.call, pitch.windupMs);
	return {
		...state,
		pendingPitch: pitch
	};
}
function remoteOutcome(state, n, outcome, contact) {
	const { phase } = state;
	if (phase.kind !== "pitching" || batterOf(state) !== "remote" || n !== state.pitchCount - 1) return state;
	return {
		...state,
		phase: {
			...phase,
			remoteOutcome: {
				outcome,
				contact
			}
		}
	};
}
function swing(state, at) {
	if (!isUserBatting(state) || state.phase.kind === "final") return state;
	if (state.swingAt !== null && at < state.swingAt + 280) return state;
	const next = withSounds({
		...state,
		swingAt: at
	}, "swing");
	const { phase } = state;
	if (phase.kind !== "pitching" || phase.swing || at < phase.pitch.releaseAt) return next;
	const result = judgeSwing({
		diffMs: at - phase.pitch.arriveAt,
		difficulty: state.config.difficulty,
		pitchIsBall: phase.pitch.isBall
	});
	return {
		...next,
		phase: {
			...phase,
			swing: {
				at,
				result
			}
		}
	};
}
function matchReducer(state, action) {
	switch (action.type) {
		case "tick": return tick({
			...state,
			now: action.now
		});
		case "selectKey": return select(state, { key: action.key });
		case "selectHeight": return select(state, { height: action.height });
		case "swing": return swing(state, action.at);
		case "remotePitch": return remotePitch(state, {
			n: action.n,
			call: action.call,
			windupMs: action.windupMs
		});
		case "remoteOutcome": return remoteOutcome(state, action.n, action.outcome, action.contact);
	}
}
function summarize(state) {
	const { userSide } = state.config;
	const botSide = userSide === "away" ? "home" : "away";
	const userRuns = totalRuns(state.game, userSide);
	const botRuns = totalRuns(state.game, botSide);
	return {
		config: state.config,
		mode: state.config.opponent === "remote" ? "pvp" : "bot",
		outcome: userRuns > botRuns ? "win" : userRuns < botRuns ? "lose" : "draw",
		userRuns,
		botRuns,
		linescore: state.game.linescore,
		userStats: state.game.stats[userSide],
		userPitching: state.game.pitching[userSide],
		inputs: state.inputs
	};
}
//#endregion
//#region src/games/zolaball/ranking/row.ts
function toGameRow(summary, nickname, id) {
	return {
		id,
		nickname: nickname.trim().slice(0, 10) || "익명",
		difficulty: summary.config.difficulty,
		outcome: summary.outcome,
		at_bats: summary.userStats.atBats,
		hits: summary.userStats.hits,
		homeruns: summary.userStats.homeruns,
		rbi: summary.userStats.rbi,
		outs_pitched: summary.userPitching.outs,
		runs_allowed: summary.userPitching.runsAllowed
	};
}
/** 랭킹에 올릴 봇 경기의 선공·후공: 서버 입장권 시드로 정한다 (서버가 다시 돌릴 때 같게) */
const userSideForSeed = (seed) => seed % 2 === 0 ? "away" : "home";
//#endregion
//#region src/server/games/zolaball.ts
const STEP_MS = 10;
/** 한 경기 최대 길이 (넘으면 이상한 기록) */
const MAX_MS = 24e5;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
function readInputs(x) {
	if (!Array.isArray(x) || x.length > 400) return null;
	const out = [];
	for (const i of x) if (i && typeof i === "object" && "sel" in i) {
		const sel = i.sel;
		const key = sel?.key ?? null;
		const height = sel?.height ?? null;
		if (key !== null && !PITCH_KEYS.includes(key) || height !== null && height !== "high" && height !== "low") return null;
		out.push({ sel: {
			key,
			height
		} });
	} else if (i && typeof i === "object" && "diff" in i) {
		if (i.diff !== null && (!isNum(i.diff) || Math.abs(i.diff) > 5e3)) return null;
		out.push({ diff: i.diff });
	} else return null;
	return out;
}
function replayZolaball(seed, difficulty, inputsIn) {
	if (difficulty !== "normal" && difficulty !== "hard") return null;
	const inputs = readInputs(inputsIn);
	if (!inputs) return null;
	let s = createMatch({
		difficulty,
		userSide: userSideForSeed(seed)
	}, 0, seed);
	let t = 0;
	/** 이번 투구에 고른 것을 이미 넣었는지 (덜 골랐으면 시간 초과를 기다림) */
	let selectedFor = -1;
	while (s.phase.kind !== "final") {
		if (t > MAX_MS) return null;
		const next = inputs[s.inputs.length];
		const { phase } = s;
		if (phase.kind === "choosing" && isUserPitching(s) && selectedFor !== s.pitchCount) {
			if (!next || !("sel" in next)) return null;
			selectedFor = s.pitchCount;
			if (next.sel.key !== null) s = matchReducer(s, {
				type: "selectKey",
				key: next.sel.key
			});
			if (next.sel.height !== null && s.phase.kind === "choosing") s = matchReducer(s, {
				type: "selectHeight",
				height: next.sel.height
			});
			continue;
		}
		if (phase.kind === "pitching" && isUserBatting(s) && !phase.swing) {
			if (!next || !("diff" in next)) return null;
			if (next.diff !== null) {
				const at = phase.pitch.arriveAt + next.diff;
				if (at < phase.pitch.releaseAt) return null;
				if (t + STEP_MS >= at) {
					t = Math.max(t, at);
					s = matchReducer({
						...s,
						now: t
					}, {
						type: "swing",
						at
					});
					if (s.phase.kind === "pitching" && !s.phase.swing) return null;
					continue;
				}
			}
		}
		t += STEP_MS;
		s = matchReducer(s, {
			type: "tick",
			now: t
		});
	}
	if (JSON.stringify(s.inputs) !== JSON.stringify(inputs)) return null;
	return summarize(s);
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
	if (body.game === "archery") {
		const r = replayArchery(ticket.seed, data.t0, data.shots);
		if (!r) return json(400, { error: "replay-mismatch" });
		const res = await insertRow(secret, "archery_games", {
			id: ticket.id,
			player_id: uid,
			nickname,
			points: r.points,
			x_count: r.xCount,
			ten_count: r.tenCount
		});
		return res === "ok" ? json(200, {
			ok: true,
			points: r.points
		}) : res === "duplicate" ? json(409, { error: "duplicate" }) : json(500, { error: "db" });
	}
	if (body.game === "batting") {
		const r = replayBatting(ticket.seed, data.difficulty, data.hand, data.swings);
		if (!r) return json(400, { error: "replay-mismatch" });
		const res = await insertRow(secret, "batting_games", {
			id: ticket.id,
			player_id: uid,
			nickname,
			difficulty: r.difficulty,
			hand: r.hand,
			points: r.points,
			homeruns: r.homeruns,
			hits: r.hits
		});
		return res === "ok" ? json(200, {
			ok: true,
			points: r.points
		}) : res === "duplicate" ? json(409, { error: "duplicate" }) : json(500, { error: "db" });
	}
	if (body.game === "zolaball") {
		const sum = replayZolaball(ticket.seed, data.difficulty, data.inputs);
		if (!sum) return json(400, { error: "replay-mismatch" });
		const res = await insertRow(secret, "zolaball_games", {
			...toGameRow(sum, nickname, ticket.id),
			player_id: uid
		});
		return res === "ok" ? json(200, {
			ok: true,
			outcome: sum.outcome
		}) : res === "duplicate" ? json(409, { error: "duplicate" }) : json(500, { error: "db" });
	}
	return json(400, { error: "bad-request" });
}
//#endregion
//#region server-entry/submit.ts
const POST = submitApi;
//#endregion
export { POST };
