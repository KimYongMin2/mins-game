import { describe, expect, it } from "vitest";
import { createRng } from "../../../shared/random";
import { chooseBotAim } from "../bot/artilleryBot";
import {
  type EngineState,
  type Player,
  createEngine,
  engineReducer,
} from "./engine";
import type { ArtilleryMsg } from "./pvp";
import {
  type ScreenState,
  canAim,
  createScreen,
  myIndex,
  screenReducer,
  toView,
  viewChanged,
} from "./view";

// 방장 기기(심판) + 친구 여럿을 가짜 통신(지연)으로 이어 끝까지 해 본다.
// 방장 자리는 봇이 대신 쏘고, 친구들은 자기 화면을 보고 봇처럼 겨눠 쏜다 (가끔은 안 쏘고 시간 초과).

function simulate(guests: number, latencyMs: number, seed: number) {
  const rng = createRng(seed);
  const players: Player[] = [
    { id: "host", name: "방장", kind: "bot" },
    ...Array.from({ length: guests }, (_, i) => ({
      id: `g${i}`,
      name: `친구${i}`,
      kind: "remote" as const,
    })),
  ];
  let engine: EngineState = createEngine({
    now: 0,
    seed,
    players,
    level: "hard",
  });
  const screens: ScreenState[] = players
    .slice(1)
    .map((p) => createScreen(p.id, 0));
  const toGuests: { at: number; msg: ArtilleryMsg }[] = [];
  const toHost: { at: number; msg: ArtilleryMsg }[] = [];
  const fireAt: (number | null)[] = screens.map(() => null);
  let last: ReturnType<typeof toView> | null = null;
  let lastAt = 0;
  for (let now = 0; now < 6_000_000; now += 16) {
    engine = engineReducer(engine, { type: "tick", now });
    for (const m of toHost.filter((m) => m.at <= now)) {
      if (
        (m.msg.t !== "aim" && m.msg.t !== "fire") ||
        m.msg.turnNo !== engine.turnNo
      )
        continue;
      const from = m.msg.from;
      engine = engineReducer(engine, {
        type: m.msg.t,
        player: players.findIndex((p) => p.id === from),
        x: m.msg.x,
        angle: m.msg.angle,
        power: m.msg.power,
      });
    }
    toHost.splice(0, toHost.length, ...toHost.filter((m) => m.at > now));
    const view = toView(engine);
    if (viewChanged(last, view) || now - lastAt >= 1000) {
      toGuests.push({ at: now + latencyMs, msg: { t: "view", v: view } });
      last = view;
      lastAt = now;
    }
    const arrived = toGuests.filter((m) => m.at <= now);
    toGuests.splice(0, toGuests.length, ...toGuests.filter((m) => m.at > now));
    screens.forEach((s, gi) => {
      let next = screenReducer(s, { type: "tick", now });
      for (const m of arrived)
        if (m.msg.t === "view")
          next = screenReducer(next, { type: "view", view: m.msg.v });
      if (canAim(next)) {
        fireAt[gi] ??=
          rng.next() < 0.1 ? Infinity : now + 500 + rng.next() * 6000;
        if (now >= fireAt[gi]!) {
          const v = next.view!;
          const aim = chooseBotAim(
            createRng(seed + now),
            v.terrain,
            v.tanks,
            myIndex(next),
            v.wind,
            "normal",
          );
          next = screenReducer(next, {
            type: "draft",
            angle: aim.angle,
            power: aim.power,
          });
          next = screenReducer(next, { type: "fire" });
          toHost.push({
            at: now + latencyMs,
            msg: {
              t: "fire",
              from: players[gi + 1].id,
              turnNo: v.turnNo,
              ...next.draft!,
            },
          });
        }
      } else fireAt[gi] = null;
      screens[gi] = next;
    });
    if (
      engine.phase.kind === "done" &&
      screens.every((s) => s.view?.phase === "done")
    )
      break;
  }
  return { engine, screens };
}

describe("친구 대전 (방장 심판 + 친구 여럿)", () => {
  for (const [guests, latency] of [
    [1, 0],
    [2, 80],
    [3, 250],
  ] as const) {
    it(`${guests + 1}명 · 지연 ${latency}ms: 끝까지 가고 모두 같은 등수·땅·체력을 본다`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const { engine, screens } = simulate(guests, latency, seed);
        expect(engine.phase.kind).toBe("done");
        const v = toView(engine);
        for (const s of screens) {
          expect(s.view?.ranks).toEqual(v.ranks);
          expect(s.view?.terrain).toEqual(v.terrain);
          expect(s.view?.tanks.map((t) => t.hp)).toEqual(
            v.tanks.map((t) => t.hp),
          );
          expect(myIndex(s)).toBeGreaterThan(0);
        }
      }
    }, 60_000);
  }

  it("차례가 아닌 사람의 발사는 무시한다", () => {
    let s = createEngine({
      now: 0,
      seed: 2,
      players: [
        { id: "a", name: "a", kind: "remote" },
        { id: "b", name: "b", kind: "remote" },
      ],
    });
    s = engineReducer(s, { type: "tick", now: 2000 });
    const other = 1 - s.turn;
    expect(
      engineReducer(s, {
        type: "fire",
        player: other,
        x: 50,
        angle: 45,
        power: 50,
      }),
    ).toBe(s);
  });
});
