import { useEffect, useRef, useState } from 'react'
import { installAudioUnlock } from '../../shared/audio/synth'
import { wantsPvp } from '../../shared/nav'
import type { Member, Room } from '../../shared/online/room'
import { loadNickname } from '../../shared/storage/nickname'
import { GroupLobby } from '../../shared/ui/GroupLobby'
import { HomeLink } from '../../shared/ui/HomeLink'
import { PlayHeader } from '../../shared/ui/PlayHeader'
import { RematchReady } from '../../shared/ui/Ready'
import { SoundToggle } from '../../shared/ui/SoundToggle'
import { exitLandscape, goLandscape, usePortraitTouch } from '../../shared/ui/landscape'
import type { TeamPick } from '../../shared/team/teams'
import type { BotLevel } from './bot/islandBot'
import { MAX_PLAYERS, MIN_PLAYERS, TEAM_SIZE, TURN_SEC, WEAPONS } from './constants'
import { GameScreen } from './game/GameScreen'
import type { IslandMsg } from './play/net'
import { type GameSummary, type IslandRecord, addGame, loadRecord, saveRecord } from './records'
import './island.css'

// 동물 섬 대작전 (2026-11-24 사용자 요청). 팀마다 동물 셋이 무너지는 섬에서 차례대로 무기를 던진다.
// 봇 연습 · 한 기기 둘이서 · 친구 대전(2~4명, 개인전 = 사람마다 자기 편 / 팀전 = 두 팀, 우리 게임 서버가 심판). 폰은 가로 화면으로.
type Screen =
  | { kind: 'start' }
  | { kind: 'game'; key: number; mode: 'bot' | 'local' }
  | { kind: 'lobby' }
  | { kind: 'pvp'; key: number; members: Member[]; bots: number; teams: TeamPick | null }
  | { kind: 'result'; summary: GameSummary }

const LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'normal', label: '일반' },
  { id: 'hard', label: '어려움' },
]

export function IslandPage() {
  const [screen, setScreen] = useState<Screen>(() => (wantsPvp() ? { kind: 'lobby' } : { kind: 'start' }))
  const [record, setRecord] = useState<IslandRecord>(() => loadRecord())
  const [room, setRoom] = useState<Room<IslandMsg> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [pvpBots, setPvpBots] = useState(0)
  const [pvpTeams, setPvpTeams] = useState<TeamPick | null>(null)
  const portrait = usePortraitTouch()
  useEffect(installAudioUnlock, [])
  useEffect(() => () => exitLandscape(), [])

  useEffect(() => {
    if (!room) return
    const offMembers = room.onMembers(setMembers)
    const offMsg = room.onMessage((msg) => {
      if (room.role === 'guest' && msg.t === 'start') setScreen({ kind: 'pvp', key: Date.now(), members: [], bots: 0, teams: null })
    })
    return () => {
      offMembers()
      offMsg()
    }
  }, [room])

  const roomRef = useRef(room)
  useEffect(() => {
    roomRef.current = room
  })
  useEffect(() => () => roomRef.current?.leave(), [])

  function update(next: IslandRecord) {
    saveRecord(next)
    setRecord(next)
  }

  const play = (mode: 'bot' | 'local') => {
    void goLandscape()
    setScreen({ kind: 'game', key: Date.now(), mode })
  }

  function startPvp(r: Room<IslandMsg>, with_: Member[], bots: number, teams: TeamPick | null) {
    const n = Math.max(0, Math.min(bots, MAX_PLAYERS - with_.length - 1))
    setPvpBots(n)
    setPvpTeams(teams)
    void goLandscape()
    r.send({ t: 'start' })
    setScreen({ kind: 'pvp', key: Date.now(), members: with_, bots: n, teams })
  }

  function finish(summary: GameSummary) {
    update(addGame(record, summary))
    setScreen({ kind: 'result', summary })
  }

  function leaveRoom() {
    room?.leave()
    setRoom(null)
    setMembers([])
    setScreen({ kind: 'start' })
  }

  const inGame = screen.kind === 'game' || screen.kind === 'pvp'
  const t = record.bot[record.level]
  const friendGuests = members.filter((m) => m.role === 'guest')
  const readyCount = friendGuests.filter((m) => m.ready).length
  const allReady = readyCount === friendGuests.length
  const s = screen.kind === 'result' ? screen.summary : null

  return (
    <main className={`page il-page arcade${inGame ? ' arcade--play' : ''}`}>
      <PlayHeader className="il-header" title="동물 섬 대작전" playing={inGame}>
        <SoundToggle />
        {inGame ? (
          <button type="button" className="button button--small" onClick={screen.kind === 'pvp' ? leaveRoom : () => setScreen({ kind: 'start' })}>
            그만하기
          </button>
        ) : (
          <HomeLink className="button button--small">나가기</HomeLink>
        )}
      </PlayHeader>

      {inGame && portrait && (
        <div className="il-rotate" role="alert">
          <b>폰을 가로로 돌려 주세요</b>
          <span>섬이 넓어서 가로 화면에서 해요</span>
          <button type="button" className="button button--primary" onClick={() => void goLandscape()}>
            가로 화면으로
          </button>
        </div>
      )}

      {screen.kind === 'start' && (
        <section className="il-start">
          <p className="il-start__lead">팀마다 동물 {TEAM_SIZE}마리, 무너지는 섬에서 차례대로 던지고 바다에 빠뜨려요.</p>
          <ul className="il-start__rules">
            <li>차례가 오면 {TURN_SEC}초 안에 걷고·점프하고·조준해서 무기 하나를 써요</li>
            <li>터지면 땅이 파이고 맞은 동물은 날아가요. 높이서 떨어지면 다치고, 바다에 빠지면 바로 탈락</li>
            <li>바람은 차례마다 바뀌고 물풍선이 바람을 타요</li>
            <li>상대 팀 동물을 모두 쓰러뜨리면 승리 · 폰은 가로 화면으로 해요</li>
          </ul>
          <ul className="il-start__weapons">
            {WEAPONS.map((w) => (
              <li key={w.id}>
                <b>{w.name}</b> {w.desc}
              </li>
            ))}
          </ul>
          <button type="button" className="button button--primary il-start__go" onClick={() => setScreen({ kind: 'lobby' })}>
            친구랑 하기 <span>({MIN_PLAYERS}~{MAX_PLAYERS}명, 개인전·팀전)</span>
          </button>
          <p className="il-start__career">
            친구 대전 {record.pvp.games}판 · {record.pvp.wins}승
          </p>
          <div className="il-start__row">
            <span className="il-start__label">봇 난이도</span>
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className="button button--small" aria-pressed={record.level === l.id} onClick={() => update({ ...record, level: l.id })}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="button il-start__go" onClick={() => play('bot')}>
            봇이랑 하기
          </button>
          <button type="button" className="button il-start__go" onClick={() => play('local')}>
            한 기기에서 둘이 하기
          </button>
          <p className="il-start__career">
            봇({LEVELS.find((l) => l.id === record.level)?.label}) {t.games}판 · {t.wins}승{t.draws ? ` · ${t.draws}무` : ''} · 둘이서 {record.local.games}판
          </p>
        </section>
      )}

      {screen.kind === 'lobby' && (
        <GroupLobby<IslandMsg>
          gameId="island"
          nickname={loadNickname() ?? '익명'}
          capacity={MAX_PLAYERS}
          minPlayers={MIN_PLAYERS}
          teams
          onConnected={setRoom}
          onStart={(with_, bots, teams) => room && startPvp(room, with_, bots, teams)}
          onBack={() => {
            room?.leave()
            setRoom(null)
            setScreen({ kind: 'start' })
          }}
        />
      )}

      {screen.kind === 'game' && <GameScreen key={screen.key} mode={screen.mode} level={record.level} onFinish={finish} />}
      {screen.kind === 'pvp' && room && <GameScreen key={screen.key} mode="pvp" level="normal" room={room} members={screen.members} bots={screen.bots} teams={screen.teams} onFinish={finish} />}

      {s && (
        <section className="il-result">
          <div className={`il-result__headline${s.mode !== 'local' && s.winner === s.myTeam ? ' il-result__headline--win' : ''}`}>
            <strong>
              {s.winner === 'draw' ? '무승부' : s.mode === 'local' ? `${s.winner === 0 ? '파랑' : '빨강'} 팀 승리!` : s.winner === s.myTeam ? (s.ffa ? '1등!' : '승리!') : s.ffa ? `${s.names[s.winner]} 우승` : '패배'}
            </strong>
            <span>
              남은 동물 {s.names.map((n, i) => `${n} ${s.left[i]}`).join(' · ')} · {s.turns}차례
            </span>
          </div>
          <p className="il-start__career">
            {s.mode === 'pvp' ? `친구 대전 ${record.pvp.games}판 · ${record.pvp.wins}승` : s.mode === 'bot' ? `봇 ${record.bot[s.level].games}판 · ${record.bot[s.level].wins}승` : `둘이서 ${record.local.games}판`}
          </p>
          {s.mode === 'pvp' && room && (
            <RematchReady room={room} gameId="island" people={members.length + 1} allReady={allReady} waitText={`친구들이 준비하길 기다려요 (${readyCount}/${friendGuests.length})`} />
          )}
          <div className="il-result__buttons">
            {(s.mode !== 'pvp' || room?.role === 'host') && (
              <button
                type="button"
                className="button button--primary"
                disabled={s.mode === 'pvp' && (!allReady || members.length + 1 + pvpBots < MIN_PLAYERS)}
                onClick={() => (s.mode === 'pvp' ? room && startPvp(room, members, pvpBots, pvpTeams) : play(s.mode))}
              >
                새 섬에서 다시
              </button>
            )}
            <button type="button" className="button" onClick={s.mode === 'pvp' ? leaveRoom : () => setScreen({ kind: 'start' })}>
              {s.mode === 'pvp' ? '나가기' : '처음으로'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
