import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  NICKNAME_MAX_LENGTH,
  loadNickname,
  saveNickname,
  validateNickname,
} from '../shared/storage/nickname'
import { GAMES } from './gameList'

/** 위에 깔리는 게임 표지 몇 장 (진짜 경기 장면) */
const COVERS = GAMES.filter((g) => g.ready).slice(0, 8)

type Props = {
  onSaved: (nickname: string) => void
}

export function NicknamePage({ onSaved }: Props) {
  const navigate = useNavigate()
  // 초대 링크로 왔으면 닉네임을 정한 뒤 그 링크로 (App의 ToNickname이 넘겨줌)
  const from = (useLocation().state as { from?: string } | null)?.from
  const [existing] = useState(loadNickname)
  const [value, setValue] = useState(existing ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const message = validateNickname(value)
    if (message) {
      setError(message)
      return
    }
    const nickname = value.trim()
    saveNickname(nickname)
    onSaved(nickname)
    navigate(from && from.startsWith('/') ? from : '/', { replace: true })
  }

  return (
    <main className="page page--center nickname">
      <div className="nickname__covers" aria-hidden>
        {COVERS.map((g) => (
          <img key={g.id} src={`/covers/${g.id}.jpg`} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="nickname__card">
      <span className="nickname__logo">MINS GAME</span>
      <h1 className="title">{existing ? '닉네임 변경' : '반가워요'}</h1>
      <p className="subtitle">친구들에게 보일 이름을 정해 주세요</p>

      <form className="nickname__form" onSubmit={handleSubmit} noValidate>
        <input
          className="input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder={`최대 ${NICKNAME_MAX_LENGTH}자`}
          aria-label="닉네임"
          aria-invalid={error !== null}
          aria-describedby={error ? 'nickname-error' : undefined}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
        />
        {error && (
          <p id="nickname-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary" type="submit">
          시작하기
        </button>
        {existing && (
          <button className="button" type="button" onClick={() => navigate('/')}>
            취소
          </button>
        )}
      </form>
      </div>
    </main>
  )
}
