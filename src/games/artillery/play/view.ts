// 화면에 그릴 것. 방장은 심판 상태에서 만들고, 친구는 방장이 보낸 것을 받는다 (시간은 '남은 ms'로 주고받음).
// 내 차례에 겨누는 것(draft)은 각 기기가 들고 있다가 심판에게 보낸다 (내 화면엔 바로 보이게).
import {
  ANGLE_MAX,
  ANGLE_MIN,
  CHARGE_MS,
  MOVE_MAX,
  POWER_MAX,
  POWER_MIN,
  STEP,
  WORLD_W,
} from "../constants";
import type { Shot, Terrain } from "../rules/physics";
import { type Boom, type EngineState, ranksOf } from "./engine";

export type PhaseKind = EngineState["phase"]["kind"];

export type ArtilleryView = {
  players: { id: string; name: string }[];
  tanks: {
    x: number;
    hp: number;
    alive: boolean;
    angle: number;
    power: number;
  }[];
  terrain: Terrain;
  turn: number;
  turnNo: number;
  wind: number;
  phase: PhaseKind;
  /** 지금 단계가 끝나기까지 */
  leftMs: number;
  /** 조준: 이번 차례 처음 자리 */
  startX: number | null;
  /** 날아가는 중: 궤적 */
  shot: Shot | null;
  /** 터짐: 결과 */
  boom: Boom | null;
  kills: number[];
  ranks: number[];
};

export function toView(s: EngineState): ArtilleryView {
  const { phase, now } = s;
  return {
    players: s.players.map(({ id, name }) => ({ id, name })),
    tanks: s.tanks.map(({ x, hp, alive, angle, power }) => ({
      x,
      hp,
      alive,
      angle,
      power,
    })),
    terrain: s.terrain,
    turn: s.turn,
    turnNo: s.turnNo,
    wind: s.wind,
    phase: phase.kind,
    leftMs: Math.max(0, phase.until - now),
    startX: phase.kind === "aim" ? phase.startX : null,
    shot: phase.kind === "flight" ? phase.shot : null,
    boom: phase.kind === "boom" ? phase.boom : null,
    kills: s.kills,
    ranks: ranksOf(s),
  };
}

/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (차례인 사람이 움직이거나 겨누는 것도) */
export function viewChanged(
  a: ArtilleryView | null,
  b: ArtilleryView,
): boolean {
  if (!a) return true;
  if (a.phase !== b.phase || a.turnNo !== b.turnNo) return true;
  const ta = a.tanks[b.turn];
  const tb = b.tanks[b.turn];
  return ta.x !== tb.x || ta.angle !== tb.angle || ta.power !== tb.power;
}

export type SoundName =
  | "count"
  | "turn"
  | "myturn"
  | "move"
  | "fire"
  | "boom"
  | "splash"
  | "hit"
  | "out"
  | "win"
  | "lose";

export type Draft = { x: number; angle: number; power: number };

export type ScreenState = {
  now: number;
  myId: string;
  view: ArtilleryView | null;
  /** 내 시계로 지금 단계가 시작한·끝나는 시각 */
  phaseStart: number;
  phaseUntil: number;
  /** 내 차례에 겨누는 것 (내 차례가 아니면 null) */
  draft: Draft | null;
  /** 이번 차례에 쐈음 (심판 답을 기다림) */
  fired: boolean;
  sounds: { id: number; name: SoundName }[];
  soundSeq: number;
};

export type ScreenAction =
  | { type: "view"; view: ArtilleryView }
  | { type: "tick"; now: number }
  /** 겨누기: 바꿀 것만 */
  | { type: "draft"; x?: number; angle?: number; power?: number }
  | { type: "fire" };

export function createScreen(myId: string, now: number): ScreenState {
  return {
    now,
    myId,
    view: null,
    phaseStart: now,
    phaseUntil: now,
    draft: null,
    fired: false,
    sounds: [],
    soundSeq: 0,
  };
}

export function myIndex(s: ScreenState): number {
  return s.view ? s.view.players.findIndex((p) => p.id === s.myId) : -1;
}

/** 지금 내가 겨눌 수 있는지 */
export function canAim(s: ScreenState): boolean {
  const v = s.view;
  return (
    !!v &&
    !!s.draft &&
    !s.fired &&
    v.phase === "aim" &&
    v.turn === myIndex(s) &&
    s.now < s.phaseUntil
  );
}

function withSounds(s: ScreenState, names: SoundName[]): ScreenState {
  if (names.length === 0) return s;
  let seq = s.soundSeq;
  const added = names.map((name) => ({ id: ++seq, name }));
  return { ...s, sounds: [...s.sounds, ...added].slice(-10), soundSeq: seq };
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function receive(s: ScreenState, v: ArtilleryView): ScreenState {
  const prev = s.view;
  const me = v.players.findIndex((p) => p.id === s.myId);
  const changed = !prev || prev.phase !== v.phase || prev.turnNo !== v.turnNo;
  if (!changed) return { ...s, view: v, phaseUntil: s.now + v.leftMs };
  const sounds: SoundName[] = [];
  let next: ScreenState = {
    ...s,
    view: v,
    phaseUntil: s.now + v.leftMs,
    phaseStart: s.now,
  };
  if (v.phase === "countdown") sounds.push("count");
  if (v.phase === "aim") {
    const mine = v.turn === me;
    sounds.push(mine ? "myturn" : "turn");
    const t = v.tanks[v.turn];
    next = {
      ...next,
      fired: false,
      draft: mine ? { x: t.x, angle: t.angle, power: t.power } : null,
    };
  }
  if (v.phase === "flight" && v.shot) {
    sounds.push("fire");
    // 늦게 받았으면 그만큼 날아간 걸로
    const total = v.shot.steps * STEP * 1000;
    next = {
      ...next,
      draft: null,
      phaseStart: s.now - Math.max(0, total - v.leftMs),
    };
  }
  if (v.phase === "boom" && v.boom) {
    const b = v.boom;
    sounds.push(b.at ? "boom" : "splash");
    if (b.damage.some((d, i) => d > 0 && prev?.tanks[i]?.alive))
      sounds.push("hit");
    if (b.dead.length) sounds.push("out");
  }
  if (v.phase === "done") sounds.push(v.ranks[me] === 1 ? "win" : "lose");
  return withSounds(next, sounds);
}

export function screenReducer(
  s: ScreenState,
  action: ScreenAction,
): ScreenState {
  switch (action.type) {
    case "tick":
      return { ...s, now: action.now };
    case "view":
      return receive(s, action.view);
    case "draft": {
      if (!canAim(s)) return s;
      const v = s.view!;
      const d = s.draft!;
      const sx = v.startX ?? d.x;
      const x =
        action.x === undefined
          ? d.x
          : Math.round(
              clamp(
                action.x,
                Math.max(3, sx - MOVE_MAX),
                Math.min(WORLD_W - 3, sx + MOVE_MAX),
              ) * 10,
            ) / 10;
      const angle =
        action.angle === undefined
          ? d.angle
          : Math.round(clamp(action.angle, ANGLE_MIN, ANGLE_MAX) * 10) / 10;
      const power =
        action.power === undefined
          ? d.power
          : Math.round(clamp(action.power, POWER_MIN, POWER_MAX) * 10) / 10;
      if (x === d.x && angle === d.angle && power === d.power) return s;
      return { ...s, draft: { x, angle, power } };
    }
    case "fire":
      if (!canAim(s)) return s;
      return { ...s, fired: true };
  }
}

/** 남은 연료 (0~1) */
export function fuelLeft(s: ScreenState): number {
  const v = s.view;
  if (!v || v.startX === null || !s.draft) return 0;
  return Math.max(0, 1 - Math.abs(s.draft.x - v.startX) / MOVE_MAX);
}

/** 힘 타이밍: 누른 지 elapsed ms일 때 힘 (0 → 100 → 0 … 왔다 갔다) */
export function chargePower(elapsed: number): number {
  const p = (Math.max(0, elapsed) % (2 * CHARGE_MS)) / CHARGE_MS;
  return Math.max(POWER_MIN, Math.round((p <= 1 ? p : 2 - p) * POWER_MAX));
}
