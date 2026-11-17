# 민스서버 설정 사본 (2026-11-17)

AWS Lightsail 서울(3.39.97.59)에만 있던 설정의 사본. 서버가 망가지면 이걸 보고 다시 만든다. **비밀 값(LiveKit 키)은 빼 둠** — 진짜 값은 서버의 `/opt/livekit/livekit.yaml`과 `~/mins-game/game-server/.env`에만.

| 파일 | 서버 위치 | 하는 일 |
|---|---|---|
| `livekit.yaml` | `/opt/livekit/livekit.yaml` | 음성·화상 서버(LiveKit) 설정. `limit`: 데이터 상한 `bytes_per_sec`, 트랙 수 `num_tracks`(서버 전체라 0 = 제한 없음) |
| `caddy.yaml` | `/opt/livekit/caddy.yaml` | https 받기 (livekit·turn·game 주소) |
| `livekit-docker-compose.yaml` | `/opt/livekit/docker-compose.yaml` | LiveKit·Caddy·Redis 컨테이너 |
| `redis.conf` | `/opt/livekit/redis.conf` | |
| `update_ip.sh` | `/opt/livekit/update_ip.sh` | (LiveKit 설치 도구가 만든 것) |
| `livekit-docker.service` | `/etc/systemd/system/livekit-docker.service` | 켤 때 자동 시작. 다시 켜기 `sudo systemctl restart livekit-docker` |
| `crontab.txt`, `update-game.sh` | `crontab -l`, `~/update-game.sh` | 5분마다 게임 서버 업데이트 확인 (`game-server/update.sh`) |
| `usage-guard.sh` | `~/usage-guard.sh` | 이번 달 데이터가 상한을 넘으면 음성 서버를 멈춤 (요금 폭탄 막기) |

게임 서버는 이 저장소의 `game-server/` 그대로 (`~/mins-game`에 받아 둠).

방화벽(Lightsail 네트워킹): 22·80·443·7881 TCP, 3478·50000-60000 UDP.
