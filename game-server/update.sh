#!/bin/sh
# 민스서버 게임 서버 자동 업데이트 (cron 5분마다 ~/update-game.sh → 이 파일).
# game-server가 바뀌었을 때만, 그리고 지금 게임 중인 방이 없을 때만 다시 켠다 (다시 켜면 진행 중인 방이 다 끊겨서 — 2026-11-16).
# '게임 중' = 최근 15분 안에 무슨 일이 있었고 접속한 사람이 있는 방 (탭만 켜 둔 방은 안 셈, 3시간 넘게 조용한 방은 서버가 닫음).
# 그래도 미룬 지 6시간이 넘었거나 새벽 4~5시(한국)면 그냥 업데이트 — 영영 밀리지 않게.
# 바로 하려면: sh ~/mins-game/game-server/update.sh now  (게임 중인 방이 있어도 지금 다시 켬 — 그 방들은 끊김)
cd ~/mins-game || exit 0
git fetch -q origin main || exit 0
PENDING=~/.game-update-pending
if git diff --quiet HEAD origin/main -- game-server; then
  # 사이트만 바뀐 건 받아 두기만 (서버는 안 다시 켬)
  git merge -q --ff-only origin/main 2>/dev/null
  rm -f "$PENDING"
  exit 0
fi
[ -f "$PENDING" ] || date +%s > "$PENDING"
waited=$(( $(date +%s) - $(cat "$PENDING") ))
active=$(curl -s -m 3 localhost:8090/stats | sed -n 's/.*"active":\([0-9]*\).*/\1/p')
hour=$(TZ=Asia/Seoul date +%H)
if [ "$1" != "now" ] && [ "${active:-0}" != "0" ] && [ "$waited" -lt 21600 ] && [ "$hour" != "04" ] && [ "$hour" != "05" ]; then
  echo "$(date) 업데이트 미룸: 게임 중인 방 $active개 (기다린 지 ${waited}초)"
  exit 0
fi
echo "$(date) 업데이트 (게임 중인 방 ${active:-0}개, 기다린 지 ${waited}초)"
git merge -q --ff-only origin/main && cd game-server && docker compose up -d --build && rm -f "$PENDING"
