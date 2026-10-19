import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  NICKNAME_MAX_LENGTH,
  loadNickname,
  saveNickname,
  validateNickname,
} from '../shared/storage/nickname'
import { StickFigure } from '../shared/ui/StickFigure'

type Props = {
  onSaved: (nickname: string) => void
}

export function NicknamePage({ onSaved }: Props) {
  const navigate = useNavigate()
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
    navigate('/', { replace: true })
  }

  return (
    <main className="page page--center">
      <StickFigure size={88} className="nickname__figure" />
      <h1 className="title">{existing ? '닉네임 변경' : '반가워요!'}</h1>
      <p className="subtitle">게임에서 쓸 닉네임을 정해 주세요.</p>

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
    </main>
  )
}
