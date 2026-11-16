// 서버 함수(Vercel)에서만 쓰는 환경 변수. 브라우저 코드에서 부르지 않는다.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

export const SUPABASE_URL = 'https://fxekefrjsmnmcuoaynfa.supabase.co'
/** Supabase 비밀 키 (sb_secret_… 또는 예전 service_role). Vercel 환경 변수에만 */
export const supabaseSecret = () => env.SUPABASE_SECRET_KEY
