import { useEffect, useState } from 'react'
import { installAudioUnlock } from '../../shared/audio/synth'
import { HomeLink } from '../../shared/ui/HomeLink'
import { PlayHeader } from '../../shared/ui/PlayHeader'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import type { BotLevel } from './bot/islandBot'
import { TEAM_SIZE, TURN_SEC, WEAPONS } from './constants'
import { GameScreen } from './game/GameScreen'
import { type GameSummary, type IslandRecord, addGame, loadRecord, saveRecord } from './records'
import './island.css'

// 동물 섬 대작전 (2026-11-24 사용자 요청). 팀마다 동물 셋이 무너지는 섬에서 차례대로 무기를 던진다.
// 지금은 봇 연습 + 한 기기 둘이서. 친구 대전(서버 심판)은 다음에.
type Screen = { kind: 'start' } | { kind: 'game'; key: number; mode: 'bot' | 'local' } | { kind: 'result'; summary: GameSummary }

const LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'normal', label: '일반' },
  { id: 'hard', label: '어려움' },
]

export function IslandPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [record, setRecord] = useState<IslandRecord>(() => loadRecord())
  useEffect(installAudioUnlock, [])

  function update(next: IslandRecord) {
    saveRecord(next)
    setRecord(next)
  }

  const play = (mode: 'bot' | 'local') => setScreen({ kind: 'game', key: Date.now(), mode })
  const inGame = screen.kind === 'game'
  const t = record.bot[record.level]

  return (
    <main className={`page il-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="il-header" title="동물 섬 대작전" playing={inGame}>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={() => setScreen({ kind: 'start' })}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">나가기</HomeLink>
        )}
      </PlayHeader>

      {screen.kind === 'start' && (
        <section className="il-start">
          <p className="il-start__lead">팀마다 동물 {TEAM_SIZE}마리, 무너지는 섬에서 차례대로 던지고 바다에 빠뜨려요.</p>
          <ul className="il-start__rules">
            <li>차례가 오면 {TURN_SEC}초 안에 걷고·점프하고·조준해서 무기 하나를 써요</li>
            <li>터지면 땅이 파이고 맞은 동물은 날아가요. 높이서 떨어지면 다치고, 바다에 빠지면 바로 탈락</li>
            <li>바람은 차례마다 바뀌고 물풍선이 바람을 타요</li>
            <li>상대 팀 동물을 모두 쓰러뜨리면 승리</li>
          </ul>
          <ul className="il-start__weapons">
            {WEAPONS.map((w) => (
              <li key={w.id}>
                <b>{w.name}</b> {w.desc}
              </li>
            ))}
          </ul>
          <div className="il-start__row">
            <span className="il-start__label">봇 난이도</span>
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className="button button--small"
                aria-pressed={record.level === l.id}
                onClick={() => update({ ...record, level: l.id })}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="button button--primary il-start__go" onClick={() => play('bot')}>
            봇이랑 하기
          </button>
          <button type="button" className="button il-start__go" onClick={() => play('local')}>
            한 기기에서 둘이 하기
          </button>
          <p className="il-start__career">
            봇({LEVELS.find((l) => l.id === record.level)?.label}) {t.games}판 · {t.wins}승{t.draws ? ` · ${t.draws}무` : ''} · 둘이서 {record.local.games}판
          </p>
          <p className="il-start__note">친구 대전(각자 기기로)은 곧 붙여요.</p>
        </section>
      )}

      {screen.kind === 'game' && (
        <GameScreen
          key={screen.key}
          mode={screen.mode}
          level={record.level}
          onFinish={(summary) => {
            update(addGame(record, summary))
            setScreen({ kind: 'result', summary })
          }}
        />
      )}

      {screen.kind === 'result' && (
        <section className="il-result">
          <div className={`il-result__headline${screen.summary.mode === 'bot' && screen.summary.winner === 0 ? ' il-result__headline--win' : ''}`}>
            <strong>
              {screen.summary.winner === 'draw'
                ? '무승부'
                : screen.summary.mode === 'bot'
                  ? screen.summary.winner === 0
                    ? '승리!'
                    : '패배'
                  : `${screen.summary.winner === 0 ? '파랑' : '빨강'} 팀 승리!`}
            </strong>
            <span>
              남은 동물 {screen.summary.mode === 'bot' ? '나' : '파랑'} {screen.summary.left[0]} : {screen.summary.left[1]} {screen.summary.mode === 'bot' ? '봇' : '빨강'} · {screen.summary.turns}차례
            </span>
          </div>
          <div className="il-result__buttons">
            <button type="button" className="button button--primary" onClick={() => play(screen.summary.mode)}>
              새 섬에서 다시
            </button>
            <button type="button" className="button" onClick={() => setScreen({ kind: 'start' })}>
              처음으로
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
