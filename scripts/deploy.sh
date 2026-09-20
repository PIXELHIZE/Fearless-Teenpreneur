#!/usr/bin/env bash
# 프로덕션 재배포: 빌드 → 기존 서버 내림 → 새 서버 올림 (같은 와이파이에서 접근 가능)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
LOG="${LOG:-data/server.log}"
mkdir -p data

npm run build
pkill -f "next start -p $PORT" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
nohup npm run start > "$LOG" 2>&1 &
sleep 4
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/login" | grep -q 200; then
  echo "배포 완료 → http://localhost:$PORT  (LAN: $(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):$PORT)"
else
  echo "서버가 응답하지 않습니다. 로그: $LOG"; tail -20 "$LOG"; exit 1
fi
