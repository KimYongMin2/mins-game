import { describe, expect, it } from "vitest";
import { EMPTY_RECORD, addGame } from "./records";

describe("포격전 기록", () => {
  it("봇 연습은 난이도별, 친구 대전은 따로", () => {
    let r = addGame(EMPTY_RECORD, {
      mode: "bot",
      level: "hard",
      rank: 1,
      kills: 2,
      ranking: [],
    });
    r = addGame(r, { mode: "pvp", rank: 2, kills: 1, ranking: [] });
    expect(r.bot.hard).toEqual({ games: 1, wins: 1, kills: 2 });
    expect(r.bot.normal.games).toBe(0);
    expect(r.pvp).toEqual({ games: 1, wins: 0, kills: 1 });
  });
});
