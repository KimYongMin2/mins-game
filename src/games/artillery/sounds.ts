import { noise, tone } from "../../shared/audio/synth";
import type { SoundName } from "./play/view";

// 탱크 대전 효과음 레시피. 모두 Web Audio로 합성한다.

const RECIPES: Record<SoundName, () => void> = {
  count: () => tone({ freq: 660, type: "square", duration: 0.1, gain: 0.06 }),
  turn: () => tone({ freq: 880, type: "triangle", duration: 0.08, gain: 0.12 }),
  // 내 차례: 띵동
  myturn: () => {
    tone({ freq: 988, type: "triangle", duration: 0.12, gain: 0.2 });
    tone({
      freq: 1319,
      type: "triangle",
      duration: 0.2,
      gain: 0.2,
      delay: 0.12,
    });
  },
  move: () =>
    noise({ filter: "lowpass", freq: 400, duration: 0.06, gain: 0.1 }),
  // 펑! 대포 발사
  fire: () => {
    noise({ filter: "lowpass", freq: 900, duration: 0.3, gain: 0.55 });
    tone({ freq: 120, to: 45, type: "sine", duration: 0.3, gain: 0.35 });
  },
  // 쾅! 터짐
  boom: () => {
    noise({ filter: "lowpass", freq: 600, duration: 0.7, gain: 0.7 });
    tone({ freq: 80, to: 30, type: "sine", duration: 0.6, gain: 0.45 });
  },
  // 빗나감: 멀리서 슝
  splash: () =>
    tone({ freq: 700, to: 250, type: "sine", duration: 0.4, gain: 0.08 }),
  hit: () =>
    tone({
      freq: 320,
      to: 140,
      type: "square",
      duration: 0.25,
      gain: 0.07,
      delay: 0.1,
    }),
  out: () => {
    [440, 349, 262].forEach((freq, i) =>
      tone({
        freq,
        type: "square",
        duration: 0.14,
        gain: 0.06,
        delay: 0.25 + i * 0.12,
      }),
    );
  },
  win: () => {
    [523, 659, 784].forEach((freq, i) =>
      tone({
        freq,
        type: "triangle",
        duration: 0.16,
        gain: 0.2,
        delay: i * 0.12,
      }),
    );
    tone({
      freq: 1047,
      type: "triangle",
      duration: 0.6,
      gain: 0.22,
      delay: 0.38,
    });
  },
  lose: () => {
    [392, 330, 262].forEach((freq, i) =>
      tone({
        freq,
        type: "triangle",
        duration: 0.22,
        gain: 0.18,
        delay: i * 0.18,
      }),
    );
  },
};

export function playSound(name: SoundName) {
  try {
    RECIPES[name]();
  } catch {
    // 오디오를 못 쓰는 환경이면 소리 없이 진행
  }
}
