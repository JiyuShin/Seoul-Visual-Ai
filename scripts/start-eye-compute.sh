#!/usr/bin/env bash
# Pi 눈 카메라 시선 처리 서버(chanulee/EyeTracker-pi)와 브리지를 켠다.
# 전시 서버를 .env 의 NEXT_PUBLIC_GAZE_SOURCE=pi 로 켰을 때 짝이 된다.
#
# 사용:  bash scripts/start-eye-compute.sh              실제 Pi 영상 처리
#        bash scripts/start-eye-compute.sh --simulate   Pi 없이 확인 (8080 운영 화면에서 마우스가 눈 역할)
# 설정:  EYE_REPO          EyeTracker-pi 폴더 (기본 ~/Documents/GitHub/EyeTracker-pi)
#        EYE_FRONTEND_URL  전시 서버 주소     (기본 http://localhost:3000)
set -euo pipefail

EYE_REPO="${EYE_REPO:-$HOME/Documents/GitHub/EyeTracker-pi}"
FRONTEND_URL="${EYE_FRONTEND_URL:-http://localhost:3000}"
if [ ! -d "$EYE_REPO/exhibition" ]; then
  echo "EyeTracker-pi 를 찾지 못했습니다: $EYE_REPO (EYE_REPO 로 위치를 지정하세요)" >&2
  exit 1
fi
cd "$EYE_REPO"

up() { curl -fs -o /dev/null --max-time 1 "http://127.0.0.1:$1$2"; }

bridge=
workers=
trap 'kill $workers $bridge 2>/dev/null || true' EXIT
trap 'exit 143' TERM INT HUP

# 이미 떠 있으면(전시 서버만 다시 켠 경우 등) 그대로 쓴다.
if up 8080 /api/status && up 8081 /api/status; then
  echo "처리 서버가 이미 켜져 있습니다 (8080/8081)."
else
  EYE_FRONTEND_URL="$FRONTEND_URL" bash start-mac.sh --no-open "$@" &
  workers=$!
  # 처음 실행이면 start-mac.sh 가 .venv 를 만들고 라이브러리를 받느라 몇 분 걸릴 수 있다.
  for _ in $(seq 1 600); do
    if [ -x .venv/bin/python ] && up 8080 /api/status; then break; fi
    kill -0 "$workers" 2>/dev/null || { echo "처리 서버가 켜지지 않았습니다." >&2; exit 1; }
    sleep 1
  done
fi

# 작품 주소를 따로 주면 start-mac.sh 는 브리지(5174)를 띄우지 않으므로 여기서 띄운다.
if up "${EYE_BRIDGE_PORT:-5174}" /; then
  echo "브리지가 이미 켜져 있습니다."
else
  .venv/bin/python -m exhibition.frontend &
  bridge=$!
fi
echo "브리지 준비: 127.0.0.1:${EYE_BRIDGE_PORT:-5174} → 전시 서버 $FRONTEND_URL"
if [ -n "$workers" ]; then wait "$workers"; elif [ -n "$bridge" ]; then wait "$bridge"; fi
