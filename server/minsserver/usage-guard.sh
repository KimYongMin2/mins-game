#!/bin/sh
# 민스서버 데이터 사용량 감시 (2026-11-17 — 요금 폭탄 막기). cron 1시간마다: ~/usage-guard.sh >> ~/usage-guard.log
# Lightsail $12 요금제는 한 달 3TB 포함, 넘으면 추가 요금. 음성·화상 상한(20Mbps)이 한 달 내내 꽉 차면 3TB를 넘을 수 있어서,
# 이번 달(서버 시각 기준) 들어오고 나간 합계가 LIMIT을 넘으면 음성 서버(LiveKit)를 멈춘다. 다음 달이 되면 다시 켠다.
# 게임 서버는 데이터가 아주 적어서 그대로 둔다. 숫자는 vnstat(설치 때부터 셈)이 잰 것.
LIMIT=2500000000000   # 2.5TB
WARN=2000000000000    # 2TB 넘으면 기록에 경고
MARK="$HOME/.usage-stopped"
MONTH=$(date +%Y-%m)
# vnstat 한 줄 출력(바이트): 9 = 이번 달 받은 양, 10 = 보낸 양, 11 = 합계
USED=$(vnstat --oneline b 2>/dev/null | cut -d';' -f11)
# 막 설치했거나 아직 못 쟀으면 숫자가 아님 → 이번엔 넘어감
case "$USED" in
  '' | *[!0-9]*) exit 0 ;;
esac

# 새 달: 지난달에 멈췄으면 다시 켬
if [ -f "$MARK" ] && [ "$(cat "$MARK")" != "$MONTH" ]; then
  echo "$(date) 새 달이라 음성 서버 다시 켬"
  sudo systemctl start livekit-docker && rm -f "$MARK"
fi

if [ "$USED" -gt "$LIMIT" ]; then
  if [ ! -f "$MARK" ]; then
    echo "$(date) 이번 달 $USED 바이트 — 상한 넘어서 음성 서버 멈춤"
    sudo systemctl stop livekit-docker && echo "$MONTH" > "$MARK"
  fi
elif [ "$USED" -gt "$WARN" ]; then
  echo "$(date) 경고: 이번 달 $USED 바이트 (상한 $LIMIT)"
fi
