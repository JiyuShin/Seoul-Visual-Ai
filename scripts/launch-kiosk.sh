#!/usr/bin/env bash
# 전시용 Chrome 실행 (모니터 1대 구성).
#
# 창 두 개를 띄운다.
#   1) 전시 창      /pre_opening   전체화면
#   2) 인원 인식 창 /presence_test 주소창 없는 작은 앱 창
#
# Chrome 은 다른 창에 가려지거나 최소화된 창을 "숨김"으로 보고 타이머를 초당 1회로 제한한다.
# 그러면 /presence_test 의 100ms 판정 루프가 멈추다시피 하므로, 아래 플래그로 그 제한을 끈다.
# 플래그는 Chrome 인스턴스가 처음 뜰 때만 적용되기 때문에 전용 프로필(--user-data-dir)을 쓰고,
# 같은 프로필로 이미 떠 있는 인스턴스가 있으면 먼저 종료한다. 평소 쓰는 Chrome 은 건드리지 않는다.
#
# 사용:  bash scripts/launch-kiosk.sh
# 환경변수로 바꿀 수 있는 값:
#   KIOSK_URL      서버 주소            (기본 http://localhost:3000)
#   KIOSK_PROFILE  전용 프로필 폴더     (기본 ~/.seoul-kiosk-chrome)
#   PRESENCE_SIZE  인식 창 크기 "W,H"   (기본 960,640)
#   PRESENCE_POS   인식 창 위치 "X,Y"   (기본 40,40)
#   CHROME_APP     Chrome 앱 번들 경로  (기본 /Applications/Google Chrome.app)
#
# 끄기: 전시용 Chrome 에서 Cmd+Q (또는 pkill -f "user-data-dir=$HOME/.seoul-kiosk-chrome")

set -euo pipefail

CHROME_APP="${CHROME_APP:-/Applications/Google Chrome.app}"
BASE_URL="${KIOSK_URL:-http://localhost:3000}"
PROFILE="${KIOSK_PROFILE:-$HOME/.seoul-kiosk-chrome}"
PRESENCE_SIZE="${PRESENCE_SIZE:-960,640}"
PRESENCE_POS="${PRESENCE_POS:-40,40}"

if [ ! -d "$CHROME_APP" ]; then
  echo "Chrome 을 찾지 못했습니다: $CHROME_APP" >&2
  exit 1
fi

if ! curl -fsS -o /dev/null --max-time 3 "$BASE_URL/presence_test"; then
  echo "서버가 응답하지 않습니다: $BASE_URL" >&2
  echo "먼저 프로젝트 폴더에서 'yarn dev' 를 실행하세요." >&2
  exit 1
fi

if pgrep -f "user-data-dir=$PROFILE" >/dev/null; then
  echo "이미 떠 있는 전시용 Chrome 을 종료합니다."
  pkill -f "user-data-dir=$PROFILE" || true
  sleep 2
fi

FLAGS=(
  --user-data-dir="$PROFILE"
  # 가려진 창·백그라운드 창의 타이머/렌더러 제한 해제 (인원 인식 창이 계속 돌게)
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  # 카메라 권한 창 없이 바로 허용, 영상·음성 자동 재생 허용
  --use-fake-ui-for-media-stream
  --autoplay-policy=no-user-gesture-required
  # 첫 실행 안내·기본 브라우저 확인·복구 안내 말풍선 끄기
  --no-first-run
  --no-default-browser-check
  --disable-session-crashed-bubble
  --hide-crash-restore-bubble
)

# `open` 으로 띄우면 launchd 가 Chrome 을 띄워 주므로, 이 스크립트(터미널)가 닫혀도 Chrome 은 남는다.
echo "전시 창 실행: $BASE_URL/pre_opening (전체화면)"
open -na "$CHROME_APP" --args "${FLAGS[@]}" --start-fullscreen "$BASE_URL/pre_opening"

# 첫 인스턴스가 뜬 뒤에 붙여야 같은 인스턴스의 새 창으로 열린다.
for _ in $(seq 1 20); do
  pgrep -f "user-data-dir=$PROFILE" >/dev/null && break
  sleep 0.5
done
sleep 2

echo "인원 인식 창 실행: $BASE_URL/presence_test (앱 창 ${PRESENCE_SIZE} @ ${PRESENCE_POS})"
open -na "$CHROME_APP" --args "${FLAGS[@]}" --app="$BASE_URL/presence_test" \
  --window-size="$PRESENCE_SIZE" --window-position="$PRESENCE_POS"

echo "완료. 전시 창이 전체화면이면 인원 인식 창은 그 뒤(다른 데스크톱)에 있습니다. 끄려면 전시용 Chrome 에서 Cmd+Q."
