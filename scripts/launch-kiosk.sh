#!/usr/bin/env bash
# 전시용 Chrome 실행 (모니터 1대 구성).
#
# Chrome 을 두 인스턴스(프로필 2개)로 띄운다.
#   1) 전시 창      /pre_opening   --kiosk  전체화면. 탭·주소창 없음, 페이지 이동·오류 복구 중에도 전체화면이 풀리지 않음.
#   2) 인원 인식 창 /presence_test --app    주소창 없는 작은 창. 바탕화면 데스크톱에 남는다.
#
# 왜 인스턴스를 나누나: --kiosk 는 그 인스턴스의 모든 창을 전체화면으로 만들기 때문에,
# 인식 창까지 전체화면이 되지 않게 별도 인스턴스로 띄운다. (프로필 폴더가 다르면 별도 인스턴스다.)
#
# Chrome 은 다른 창에 가려지거나 다른 데스크톱(Space)에 있는 창을 "숨김"으로 보고 타이머를 초당 1회로 제한한다.
# 그러면 /presence_test 의 100ms 판정 루프가 멈추다시피 하므로, 두 인스턴스 모두 아래 플래그로 그 제한을 끈다.
# 플래그는 Chrome 인스턴스가 처음 뜰 때만 적용되기 때문에 전용 프로필(--user-data-dir)을 쓰고,
# 이미 떠 있는 전시용 인스턴스는 먼저 종료한다. 평소 쓰는 Chrome 은 건드리지 않는다.
#
# 사용:  bash scripts/launch-kiosk.sh          실행
#        bash scripts/launch-kiosk.sh stop     전시용 Chrome 두 개 모두 종료
# 환경변수로 바꿀 수 있는 값:
#   KIOSK_URL      서버 주소            (기본 http://localhost:3000)
#   KIOSK_PROFILE  전용 프로필 폴더     (기본 ~/.seoul-kiosk-chrome, 아래에 display/ sensor/ 가 생긴다)
#   PRESENCE_SIZE  인식 창 크기 "W,H"   (기본 960,640)
#   PRESENCE_POS   인식 창 위치 "X,Y"   (기본 40,40)
#   CHROME_APP     Chrome 앱 번들 경로  (기본 /Applications/Google Chrome.app)
#   KIOSK_DEBUG=1  전시 창 왼쪽 아래에 센서 상태(얼굴 수·통과 인원·진행률)를 띄운다.
#                  인식 창이 전체화면 뒤에 가려져 있어도 왜 안 넘어가는지 볼 수 있다.
#
# 전시 창은 macOS 전체화면이라 별도 데스크톱(Space)에 뜬다. 인식 창을 보려면 트랙패드 세 손가락 좌우 스와이프
# 또는 Ctrl+←/→ 로 바탕화면 데스크톱으로 넘어가면 된다. 전시 창에서 Cmd+Q 를 누르면 전시 창만 꺼지므로,
# 둘 다 끄려면 `bash scripts/launch-kiosk.sh stop`.

set -euo pipefail

CHROME_APP="${CHROME_APP:-/Applications/Google Chrome.app}"
BASE_URL="${KIOSK_URL:-http://localhost:3000}"
PROFILE_ROOT="${KIOSK_PROFILE:-$HOME/.seoul-kiosk-chrome}"
DISPLAY_PROFILE="$PROFILE_ROOT/display"
SENSOR_PROFILE="$PROFILE_ROOT/sensor"
PRESENCE_SIZE="${PRESENCE_SIZE:-960,640}"
PRESENCE_POS="${PRESENCE_POS:-40,40}"
DISPLAY_URL="$BASE_URL/pre_opening"
if [ "${KIOSK_DEBUG:-0}" = "1" ]; then
  DISPLAY_URL="$DISPLAY_URL?presenceDebug=1"
fi

stop_kiosk() {
  if pgrep -f "user-data-dir=$PROFILE_ROOT" >/dev/null; then
    pkill -f "user-data-dir=$PROFILE_ROOT" || true
    sleep 2
    return 0
  fi
  return 1
}

if [ "${1:-}" = "stop" ]; then
  if stop_kiosk; then echo "전시용 Chrome 을 종료했습니다."; else echo "떠 있는 전시용 Chrome 이 없습니다."; fi
  exit 0
fi

if [ ! -d "$CHROME_APP" ]; then
  echo "Chrome 을 찾지 못했습니다: $CHROME_APP" >&2
  exit 1
fi

if ! curl -fsS -o /dev/null --max-time 3 "$BASE_URL/presence_test"; then
  echo "서버가 응답하지 않습니다: $BASE_URL" >&2
  echo "먼저 프로젝트 폴더에서 'yarn dev' 를 실행하세요." >&2
  exit 1
fi

if stop_kiosk; then
  echo "이미 떠 있던 전시용 Chrome 을 종료했습니다."
fi
mkdir -p "$DISPLAY_PROFILE" "$SENSOR_PROFILE"

COMMON=(
  # 가려진 창·백그라운드 창·다른 데스크톱의 창에 걸리는 타이머/렌더러 제한 해제 (인원 인식 창이 계속 돌게)
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  # 카메라·마이크 권한 창 없이 바로 허용, 영상·음성 자동 재생 허용
  --use-fake-ui-for-media-stream
  --autoplay-policy=no-user-gesture-required
  # 첫 실행 안내·기본 브라우저 확인·복구 안내 말풍선 끄기
  --no-first-run
  --no-default-browser-check
  --disable-session-crashed-bubble
  --hide-crash-restore-bubble
)

wait_for_instance() { # <profile dir>
  for _ in $(seq 1 20); do
    pgrep -f "user-data-dir=$1" >/dev/null && return 0
    sleep 0.5
  done
  return 1
}

# `open` 으로 띄우면 launchd 가 Chrome 을 띄워 주므로, 이 스크립트(터미널)가 닫혀도 Chrome 은 남는다.
# 인식 창을 먼저, 전시 창을 나중에 띄워서 마지막에 뜬 전시 창(전체화면 데스크톱)이 화면에 남게 한다.
echo "인원 인식 창 실행: $BASE_URL/presence_test (앱 창 ${PRESENCE_SIZE} @ ${PRESENCE_POS})"
open -na "$CHROME_APP" --args --user-data-dir="$SENSOR_PROFILE" "${COMMON[@]}" \
  --app="$BASE_URL/presence_test" --window-size="$PRESENCE_SIZE" --window-position="$PRESENCE_POS"
wait_for_instance "$SENSOR_PROFILE" || echo "경고: 인식 창 프로세스를 확인하지 못했습니다." >&2
sleep 2

echo "전시 창 실행: $DISPLAY_URL (kiosk 전체화면)"
open -na "$CHROME_APP" --args --user-data-dir="$DISPLAY_PROFILE" "${COMMON[@]}" --kiosk "$DISPLAY_URL"
wait_for_instance "$DISPLAY_PROFILE" || echo "경고: 전시 창 프로세스를 확인하지 못했습니다." >&2

echo "완료. 인식 창은 바탕화면 데스크톱에 있습니다(Ctrl+← 로 이동). 모두 끄려면: bash scripts/launch-kiosk.sh stop"
