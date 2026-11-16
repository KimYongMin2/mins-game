// 쉬운 우리말 낱말 (직접 고름, 상표 이름 없음) — 그림 맞히기 제시어·초성 퀴즈 문제가 같이 씀. 보기·힌트용 갈래.
export const WORD_GROUPS: Record<string, readonly string[]> = {
  동물: ['기린', '코끼리', '고양이', '강아지', '토끼', '거북이', '사자', '호랑이', '펭귄', '돼지', '원숭이', '뱀', '개구리', '오리', '닭', '말', '소', '양', '곰', '판다', '여우', '늑대', '다람쥐', '고슴도치', '하마', '악어', '얼룩말', '낙타', '캥거루', '부엉이', '독수리', '앵무새', '참새', '박쥐', '쥐', '사슴', '물개', '고래', '상어', '문어', '오징어', '게', '새우', '달팽이', '나비', '벌', '개미', '거미', '무당벌레', '잠자리'],
  음식: ['사과', '바나나', '포도', '수박', '딸기', '복숭아', '귤', '파인애플', '체리', '레몬', '당근', '옥수수', '감자', '고구마', '브로콜리', '버섯', '김밥', '라면', '떡볶이', '피자', '햄버거', '치킨', '아이스크림', '케이크', '도넛', '빵', '우유', '계란', '치즈', '사탕', '초콜릿', '쿠키', '핫도그', '만두', '주먹밥', '팝콘', '솜사탕', '붕어빵', '호떡'],
  물건: ['우산', '안경', '모자', '신발', '양말', '가방', '시계', '연필', '지우개', '가위', '자', '책', '공책', '컵', '숟가락', '젓가락', '포크', '칼', '냄비', '프라이팬', '의자', '책상', '침대', '소파', '텔레비전', '냉장고', '선풍기', '전화기', '컴퓨터', '카메라', '열쇠', '자물쇠', '전구', '촛불', '거울', '빗', '칫솔', '수건', '휴지', '풍선', '선물', '편지', '왕관', '반지', '목걸이', '망치', '사다리', '바구니', '빗자루', '주전자'],
  탈것: ['자동차', '버스', '기차', '비행기', '배', '자전거', '오토바이', '헬리콥터', '로켓', '트럭', '소방차', '구급차', '경찰차', '택시', '잠수함', '열기구', '스케이트보드', '유모차', '지하철', '트랙터'],
  자연: ['해', '달', '별', '구름', '비', '눈사람', '무지개', '번개', '산', '바다', '강', '섬', '나무', '꽃', '해바라기', '장미', '선인장', '나뭇잎', '불', '화산', '폭포', '파도', '돌', '모래성', '토네이도'],
  장소: ['집', '학교', '병원', '성', '교회', '등대', '다리', '놀이터', '수영장', '공원', '동물원', '캠핑', '텐트', '피라미드', '탑', '감옥', '빌딩', '시장', '도서관', '우체국'],
  운동: ['축구공', '야구공', '농구공', '배드민턴', '볼링', '스키', '수영', '태권도', '줄넘기', '양궁', '골프', '탁구', '씨름', '스케이트', '등산', '낚시', '달리기', '권투', '요가', '서핑'],
  사람: ['의사', '경찰', '소방관', '요리사', '선생님', '가수', '해적', '마법사', '공주', '왕', '로봇', '외계인', '유령', '천사', '닌자', '산타', '광대', '우주인', '농부', '화가'],
}

export const WORDS: readonly string[] = Object.values(WORD_GROUPS).flat()

export function groupOf(word: string): string | null {
  for (const [g, ws] of Object.entries(WORD_GROUPS)) if (ws.includes(word)) return g
  return null
}

/** 정답 비교: 띄어쓰기·대소문자 무시 */
export const normalizeGuess = (s: string) => s.replace(/\s+/g, '').toLowerCase()

const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const BASE = 0xac00
const END = 0xd7a3

export const isSyllable = (ch: string) => {
  const c = ch.charCodeAt(0)
  return c >= BASE && c <= END
}

/** 한 글자 → [초성, 중성, 종성] 번호 (한글 글자가 아니면 null) */
export function splitSyllable(ch: string): [number, number, number] | null {
  if (!isSyllable(ch)) return null
  const n = ch.charCodeAt(0) - BASE
  return [Math.floor(n / 588), Math.floor((n % 588) / 28), n % 28]
}

export const joinSyllable = (cho: number, jung: number, jong: number) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong)

/** 낱말의 초성 ('기린' → 'ㄱㄹ'). 한글이 아닌 글자는 그대로 */
export const chosungOf = (word: string) => [...word].map((ch) => (splitSyllable(ch) ? CHOSUNG[splitSyllable(ch)![0]] : ch)).join('')

/**
 * 두음법칙으로 바꿀 수 있는 첫 글자 (끝말잇기): 'ㄹ' → 'ㄴ'(라→나), 'ㄹ'·'ㄴ' + ㅑㅕㅖㅛㅠㅣ → 'ㅇ'(려→여, 녀→여).
 * 원래 글자 포함해서 돌려준다
 */
export function initialVariants(ch: string): string[] {
  const s = splitSyllable(ch)
  if (!s) return [ch]
  const [cho, jung, jong] = s
  const out = [ch]
  const yVowel = ['ㅑ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ', 'ㅣ'].includes(JUNG[jung])
  const R = 5
  const N = 2
  const O = 11
  if (cho === R) out.push(joinSyllable(yVowel ? O : N, jung, jong))
  if (cho === N && yVowel) out.push(joinSyllable(O, jung, jong))
  return out
}
