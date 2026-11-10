import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { clearPvpEntry, readPvpEntry } from '../nav'
import { goHome } from './HomeLink'
import { type ListedRoom, type Member, type Room, RoomError, channelCode, createRoom, joinRoom, makeRoomCode } from '../online/room'
import { encodeLook } from '../art3d/animalKinds'
import { loadLook } from '../storage/avatar'
import { TEAM_COLORS, TEAM_NAMES, type Team, type TeamPick, assignTeams, teamsReady } from '../team/teams'
import { ReadyButton } from './Ready'
import { InviteButton } from './Invite'
import { RoomBadge, RoomPicker } from './RoomPicker'

// 여럿이 하는 게임의 대기실: 열린 방 목록에서 고르거나 방 만들기(이름 · 전체 공개 / 비공개 코드) → 모인 사람 목록.
// 방장이 시작하면 목록에 '게임 중'으로 바뀌어 새로 못 들어온다.
// 방장은 빈자리에 봇을 채울 수 있다(사람이 모자랄 때). 방장이 [시작]을 누르면 onStart로 사람 목록과 봇 수를 넘긴다. 친구 쪽 시작은 게임이 메시지로 처리한다.
// 연결되면 바로 onConnected로 방을 넘기고, 그 뒤로 방을 닫는 건 게임(페이지)이 한다. 게임 규칙은 모른다.

type Props<M> = {
  gameId: string
  nickname: string
  /** 정원 (나 포함) */
  capacity: number
  /** 이만큼 모여야 시작할 수 있다 (나 포함) */
  minPlayers: number
  onConnected: (room: Room<M>) => void
  /** 팀전을 고를 수 있는 게임이면 true */
  teams?: boolean
  /** 팀전에서 '같은 팀 공격'을 켜고 끌 수 있는 게임이면 true (기본은 끔) */
  friendlyFire?: boolean
  /** 방장이 시작함. 나 말고 방에 있는 사람들 (들어온 순서)과 채울 봇 수, 팀전이면 id(방장 id · 친구 id · 'bot0'…) → 팀 */
  onStart: (members: Member[], bots: number, teams: TeamPick | null, friendlyFire: boolean) => void
  /** 돌아가기 (연결된 방이 있으면 이미 닫은 뒤) */
  onBack: () => void
}

type View =
  | { kind: 'menu' }
  | { kind: 'busy'; text: string }
  | { kind: 'waiting'; id: string; name: string; pin: string | null }
  | { kind: 'error'; text: string }

const ERROR_TEXT: Record<RoomError['reason'], string> = {
  'not-found': '방이 없어졌어요',
  full: '방이 가득 찼어요',
  offline: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요',
}

/** 방 사람 목록으로 알릴 내 캐릭터 */
const myAvatar = () => {
  const l = loadLook()
  return l ? encodeLook(l) : undefined
}

export function GroupLobby<M>({ gameId, nickname, capacity, minPlayers, teams: canTeam = false, friendlyFire: canFriendlyFire = false, onConnected, onStart, onBack }: Props<M>) {
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [room, setRoom] = useState<Room<M> | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [botsWanted, setBotsWanted] = useState(0)
  const [teamMode, setTeamMode] = useState(false)
  const [pick, setPick] = useState<TeamPick>({})
  const [friendlyFire, setFriendlyFire] = useState(false)
  // 방에 들어가는 도중에 화면을 떠나면, 다 열린 방을 바로 닫는다
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!room) return
    return room.onMembers(setMembers)
  }, [room])

  function connected(r: Room<M>, id: string, name: string, pin: string | null) {
    if (!mountedRef.current) {
      r.leave()
      return
    }
    setRoom(r)
    setView({ kind: 'waiting', id, name, pin })
    onConnected(r)
  }

  // 메인 게임 창에서 고르고 들어왔으면(주소 꼬리) 바로 방 만들기·들어가기, '돌아가기'는 메인으로 (사용자 요청)
  const navigate = useNavigate()
  const [entry] = useState(readPvpEntry)
  const autoRef = useRef(false)
  useEffect(() => {
    if (autoRef.current || !entry) return
    autoRef.current = true
    clearPvpEntry()
    if (entry.kind === 'create') void host(entry.name, entry.pin)
    else if (entry.kind === 'join') void join(entry.room as ListedRoom, entry.pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const goBack = () => (entry ? goHome(navigate) : onBack())

  function fail(e: unknown, wrongPin = false) {
    if (!(e instanceof RoomError)) console.warn('[room] 방 접속 오류', e)
    const text = e instanceof RoomError ? (e.reason === 'not-found' && wrongPin ? '코드가 틀렸어요 (방이 없어졌을 수도 있어요)' : ERROR_TEXT[e.reason]) : ERROR_TEXT.offline
    setView({ kind: 'error', text })
  }

  async function host(name: string, pin: string | null) {
    setView({ kind: 'busy', text: '방을 만드는 중…' })
    try {
      const id = makeRoomCode()
      connected(await createRoom<M>(gameId, nickname, { avatar: myAvatar(), capacity, code: channelCode(id, pin), listing: { id, name, locked: !!pin } }), id, name, pin)
    } catch (e) {
      fail(e)
    }
  }

  async function join(r: ListedRoom, pin: string | null) {
    setView({ kind: 'busy', text: '방에 들어가는 중…' })
    try {
      connected(await joinRoom<M>(gameId, channelCode(r.id, pin), nickname, { avatar: myAvatar(), capacity }), r.id, r.name, pin)
    } catch (e) {
      fail(e, !!pin)
    }
  }

  function leave() {
    room?.leave()
    goBack()
  }

  if (view.kind === 'waiting' && room) {
    const isHost = room.role === 'host'
    const hostGone = !isHost && !members.some((m) => m.role === 'host')
    // 친구가 더 들어와 자리가 모자라면 봇을 그만큼 줄인다
    const bots = Math.min(botsWanted, capacity - members.length - 1)
    const count = members.length + 1 + bots
    // 팀전: 자리 id 순서는 게임이 사람을 늘어놓는 순서와 같다 (방장 → 친구 → 봇)
    const ids = [room.myId, ...members.map((m) => m.id), ...Array.from({ length: bots }, (_, i) => `bot${i}`)]
    const teamOf = teamMode && isHost ? assignTeams(ids, pick) : null
    const teamChip = (i: number) => {
      if (!teamOf) return null
      const t = teamOf[i]
      return (
        <button
          type="button"
          className="group-lobby__team"
          style={{ background: TEAM_COLORS[t] }}
          onClick={() => setPick({ ...Object.fromEntries(ids.map((id, k) => [id, teamOf[k]])), [ids[i]]: (1 - t) as Team })}
          aria-label={`${TEAM_NAMES[t]} (눌러서 바꾸기)`}
        >
          {TEAM_NAMES[t]}
        </button>
      )
    }
    const ready = !teamOf || teamsReady(teamOf)
    // 준비 (사용자 요청): 친구가 모두 [준비]해야 방장이 시작할 수 있다. 봇은 늘 준비
    const guests = members.filter((m) => m.role === 'guest')
    const readyCount = guests.filter((m) => m.ready).length
    const allReady = readyCount === guests.length
    return (
      <section className="pvp-lobby">
        <RoomBadge name={view.name} pin={view.pin} />
        {count < capacity && <InviteButton room={{ id: view.id, name: view.name }} pin={view.pin} />}
        <span className="pvp-lobby__wait">
          {count}/{capacity}명
        </span>
        <ul className="group-lobby__members">
          <li className="group-lobby__member group-lobby__member--me">
            <span className="group-lobby__name">
              {nickname} <span>(나{isHost ? ' · 방장' : ''})</span>
            </span>
            {teamChip(0)}
          </li>
          {members.map((m, i) => (
            <li key={m.id} className="group-lobby__member">
              <span className="group-lobby__name">
                {m.nickname} {m.role === 'host' && <span>(방장)</span>}
              </span>
              {m.role === 'guest' && <span className={`group-lobby__ready${m.ready ? ' group-lobby__ready--on' : ''}`}>{m.ready ? '준비 완료' : '준비 중'}</span>}
              {teamChip(1 + i)}
            </li>
          ))}
          {Array.from({ length: bots }, (_, i) => (
            <li key={`bot${i}`} className="group-lobby__member group-lobby__member--bot">
              <span className="group-lobby__name">봇 {i + 1}</span>
              {teamChip(1 + members.length + i)}
            </li>
          ))}
        </ul>
        {isHost ? (
          <>
            {canTeam && (
              <div className="group-lobby__mode" role="group" aria-label="개인전 / 팀전">
                <button type="button" className={`button button--small${teamMode ? '' : ' group-lobby__mode--on'}`} onClick={() => setTeamMode(false)}>
                  개인전
                </button>
                <button type="button" className={`button button--small${teamMode ? ' group-lobby__mode--on' : ''}`} onClick={() => setTeamMode(true)}>
                  팀전
                </button>
                {teamMode && <span className="group-lobby__mode-tip">팀 이름을 누르면 바뀌어요</span>}
              </div>
            )}
            {canTeam && canFriendlyFire && teamMode && (
              <div className="group-lobby__mode" role="group" aria-label="같은 팀 공격">
                <span className="group-lobby__mode-label">같은 팀 공격</span>
                <button type="button" className={`button button--small${friendlyFire ? '' : ' group-lobby__mode--on'}`} onClick={() => setFriendlyFire(false)}>
                  안 됨
                </button>
                <button type="button" className={`button button--small${friendlyFire ? ' group-lobby__mode--on' : ''}`} onClick={() => setFriendlyFire(true)}>
                  됨
                </button>
              </div>
            )}
            <div className="group-lobby__bots" role="group" aria-label="봇 수">
              <span>빈자리에 봇</span>
              <button type="button" className="button button--small" disabled={bots <= 0} onClick={() => setBotsWanted(bots - 1)} aria-label="봇 빼기">
                −
              </button>
              <strong>{bots}</strong>
              <button
                type="button"
                className="button button--small"
                disabled={members.length + 1 + bots >= capacity}
                onClick={() => setBotsWanted(bots + 1)}
                aria-label="봇 더하기"
              >
                +
              </button>
            </div>
            <button type="button" className="button button--primary pvp-lobby__big" disabled={count < minPlayers || !ready || !allReady} onClick={() => {
                room.setPlaying(true)
                onStart(members, bots, teamOf ? Object.fromEntries(ids.map((id, k) => [id, teamOf[k]])) : null, !!teamOf && canFriendlyFire && friendlyFire)
              }}>
              {count < minPlayers
                ? `${minPlayers}명부터 시작할 수 있어요`
                : !ready
                  ? '두 팀에 한 명 이상씩 있어야 해요'
                  : !allReady
                    ? `친구들이 준비하길 기다려요 (${readyCount}/${guests.length})`
                    : `${count}명으로 ${teamOf ? '팀전 ' : ''}시작${bots > 0 ? ` (봇 ${bots})` : ''}`}
            </button>
          </>
        ) : (
          hostGone ? <p className="pvp-lobby__status">방장이 나갔어요</p> : <ReadyButton room={room} />
        )}
        <button type="button" className="button button--small pvp-lobby__back" onClick={leave}>
          나가기
        </button>
      </section>
    )
  }

  return (
    <section className="pvp-lobby">
      {view.kind === 'busy' ? (
        <p className="pvp-lobby__status">{view.text}</p>
      ) : (
        <RoomPicker gameId={gameId} nickname={nickname} onCreate={(name, pin) => void host(name, pin)} onJoin={(r, pin) => void join(r, pin)} error={view.kind === 'error' ? view.text : undefined} />
      )}
      <button type="button" className="button button--small pvp-lobby__back" onClick={goBack}>
        돌아가기
      </button>
    </section>
  )
}
