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
const ANNOUNCE_MS = 1400;
const SCORED_MS = 1300;
const CENTER = {
	x: 0,
	y: 0
};
function currentDistance(state) {
	return distanceOfArrow(Math.min(state.arrowIndex, TOTAL_ARROWS - 1));
}
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
/** 화살마다 새 바람과 흔들림 모양 */
function prepareArrow(state, index, now) {
	const rng = createRng(state.seed);
	const wind = randomWind(rng);
	const swayPhase = rng.next() * Math.PI * 2;
	const announce = isFirstAtDistance(index);
	const phase = announce ? {
		kind: "announce",
		until: now + ANNOUNCE_MS
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
	return withSounds$2({
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
	return withSounds$2({
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
function tick$2(state) {
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
			return withSounds$2({
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
			if (next >= TOTAL_ARROWS) return withSounds$2({
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
		case "tick": return tick$2({
			...state,
			now: action.now
		});
		case "press":
			if (state.phase.kind !== "ready") return state;
			return withSounds$2({
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
const isNum$1 = (x) => typeof x === "number" && Number.isFinite(x);
/** 놓은 시각이 자동 발사·시간 끝보다 이만큼 늦어도 봐줌 (화면 한 프레임) */
const SLACK_MS = 50;
function readShots(x) {
	if (!Array.isArray(x) || x.length !== TOTAL_ARROWS) return null;
	const out = [];
	for (const s of x) {
		if (!s || typeof s !== "object") return null;
		const aim = s.aim;
		if (!aim || !isNum$1(aim.x) || !isNum$1(aim.y)) return null;
		const pressAt = s.pressAt === null ? null : isNum$1(s.pressAt) ? s.pressAt : void 0;
		const releaseAt = s.releaseAt === null ? null : isNum$1(s.releaseAt) ? s.releaseAt : void 0;
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
	if (!shots || !isNum$1(t0)) return null;
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
function judgeSwing(opts) {
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
function within(rng, [min, max]) {
	return min + rng.next() * (max - min);
}
function createBattedBall(opts) {
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
				y: within(rng, [11, 14]),
				z: within(rng, [-9, -6])
			}
		};
		const angle = Math.sign(lateness || 1) * handSign * within(rng, [55, 72]) * Math.PI / 180;
		const speed = within(rng, [22, 28]);
		return {
			startAt,
			duration: 1300,
			start,
			velocity: {
				x: Math.sin(angle) * speed,
				y: within(rng, [6, 10]),
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
	const launch = within(rng, LAUNCH_DEG[outcome]) * Math.PI / 180;
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
function battedBallEndAt(ball) {
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
const FLIGHT_MS = {
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
function createPitch(rng, difficulty, releaseAt) {
	const type = pickOne(rng, PITCH_TYPES);
	const cell = pickOne(rng, CELLS);
	const jitter = (rng.next() * 2 - 1) * 25;
	return {
		type,
		cell,
		releaseAt,
		arriveAt: releaseAt + FLIGHT_MS[difficulty][type] + jitter
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
function pitchEndAt(pitch) {
	return pitch.arriveAt + 320;
}
//#endregion
//#region src/games/batting/play/session.ts
const FIRST_READY_MS = 1200;
/** 공과 공 사이 쉬는 시간 */
const READY_MS = 1500;
/** 결과를 보여주는 최소 시간 */
const RESULT_MS = 1800;
/** 마지막 공 뒤 '경기 끝'을 보여주고 결과 화면으로 넘어가기까지 */
const DONE_MS$1 = 1800;
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
	const pitch = createPitch(rng, state.difficulty, releaseAt);
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
	const batted = swing && record.contact && record.offsetMs !== null ? createBattedBall({
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
	const until = Math.max(state.now + RESULT_MS, batted ? battedBallEndAt(batted) : 0);
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
function swing(state, point, at) {
	const { phase } = state;
	if (phase.kind !== "pitching" || phase.swing) return state;
	const { pitch } = phase;
	const result = judgeSwing({
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
	if (result.outcome === "whiff") return withSounds$1({
		...state,
		phase: {
			...phase,
			swing: s,
			record
		}
	}, "whiff");
	return withSounds$1(showResult(state, pitch, s, record), ...hitSound(record));
}
function tick$1(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "ready": return now >= phase.until ? startWindup(state) : state;
		case "windup":
			if (now < phase.until) return state;
			return withSounds$1({
				...state,
				phase: {
					kind: "pitching",
					pitch: phase.pitch,
					swing: null,
					record: null
				}
			}, "pitch");
		case "pitching": {
			if (now < pitchEndAt(phase.pitch)) return state;
			const record = phase.record ?? {
				index: state.index,
				pitch: phase.pitch,
				touched: null,
				outcome: "looking",
				contact: null,
				offsetMs: null,
				distance: null
			};
			return withSounds$1(showResult(state, phase.pitch, phase.swing, record), "mitt");
		}
		case "result": {
			if (now < phase.until) return state;
			const next = state.index + 1;
			if (next >= 10) return withSounds$1({
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
		case "tick": return tick$1({
			...state,
			now: action.now
		});
		case "swing": return swing(state, action.point, action.at);
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
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
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
		if (!p || !isNum(p.col) || !isNum(p.row) || Math.abs(p.col - 1) > 3 || Math.abs(p.row - 1) > 3 || !isNum(o.offsetMs) || Math.abs(o.offsetMs) > 5e3) return null;
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
	return json(400, { error: "bad-request" });
}
//#endregion
//#region server-entry/submit.ts
const POST = submitApi;
//#endregion
export { POST };
