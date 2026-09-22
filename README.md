# Visual AI Glass — Scene 2–3 Prototype

시선 기반 회의 주제 선택 → 대비 이미지 → 시선+보이스 의견 입력 → 시선 기반 공감(하트) 웹 프로토타입입니다.

## 실행

```bash
yarn install
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 두 사람이 함께 고르기 (웹캠 2대)

1단계 투표는 두 사람이 같은 카드를 바라봐야 선택됩니다. WebGazer는 창마다 카메라 하나·얼굴
하나만 다루므로 창을 두 개 띄웁니다.

| 창 | 주소 | 역할 |
| --- | --- | --- |
| 표시 창 | `/app` → `/1` | 카드를 그리고, 자기 웹캠으로 1번 참가자를 추적 |
| 트래커 창 | `/tracker` | 다른 웹캠을 골라 2번 참가자의 시선만 전송 |

두 창이 같은 화면을 가리키도록 각각 전체화면으로 띄우세요. 트래커 창에서 참가자와 웹캠을 고르고
9점 보정을 마치면 시선이 표시 창으로 흐릅니다.

카드는 응시 인원에 따라 두 단계로 커집니다. 한 명이 보면 조금(1.07배), 두 명이 함께 보면
최종 크기(1.18배)까지 커집니다. 점수는 응시한 시간의 합에 "함께 본 시간"을 가중해서 쌓이므로,
혼자 오래 보는 것보다 둘이 같이 보는 쪽이 4배 빠르게 확정됩니다.

## 사용 방법

1. **카메라 권한 허용** — WebGazer.js가 눈동자 추적에 웹캠을 사용합니다.
2. **시선 보정 (클릭 없음)** — 9개 점이 순서대로 나타납니다. **마우스를 쓰지 말고** 각 점을 **2.5초간 눈으로만** 바라보세요. "얼굴 인식됨"이 표시되어야 합니다.
3. **1단계 [vote]** — 5개 비전 카드 중 하나를 **3초간 응시**하면 선택됩니다. 점선 리티클이 **실제 시선**을 따라갑니다.
4. **2단계 [reveal]** — 선택된 비전 + 현재 서울 거리 대비 이미지 + AI 에이전트 대사
5. **3단계 [discussion]** — 거리 이미지의 지점을 1.2초간 응시하며 말하거나 텍스트 입력 → 의견 핀 생성. 다른 사람의 핀을 2초간 응시 → ♥ 공감
6. **4단계 [done]** — 수집된 핀 데이터 확인

## 기술 스택

- Next.js (Pages Router) + React (JavaScript)
- 커스텀 서버(`server.mjs`) + `ws` — 시선 좌표를 실시간으로 주고받는 WebSocket (`/ws/vote`)
- WebGazer.js — 웹캠 시선 추적
- Web Speech API — 음성 입력 (실패 시 텍스트 입력 fallback)
- CSS Modules

## 프로젝트 구조

소스는 페이지 단위로 폴더를 나눕니다. 페이지 주소와 폴더 이름이 1:1로 대응하므로,
`/1`을 고칠 때는 `src/f1/`만 보면 됩니다. 여러 페이지가 함께 쓰는 것만 `src/shared/`에 둡니다.

```
server.mjs                 # Next.js + WebSocket 커스텀 서버

src/shared/                # 모든 페이지 공용
  EntryFlowContext.jsx     # 페이지 사이를 잇는 상태 (선택된 카드, 핀, 시선)
  EntryPageShell.jsx       # 배경·로딩·오류·바닥글 공용 셸
  useGazeTracker.js        # WebGazer 초기화 (참가자·카메라 선택 가능)
  gazeSmoother.js          # 시선 좌표 보정 파이프라인
  gazeConfig.js            # 상수 (카드 목록, 응시 시간, 투표 설정)
  loadWebGazer.js
  DreamyBackground.jsx
  GazeReticle.jsx

src/calibration/           # /app  시선 보정
src/f1/                    # /1    비전 카드 투표 + 대비 이미지
  VoteStep/                #       두 사람 응시로 카드 선택
  RevealStep/              #       선택된 비전 + 현재 거리 대비
  useVoteSync.js           #       투표 룸 연결 훅
  voteSocket.js            #       재연결 지원 WebSocket 클라이언트
  voteState.js             #       다인 응시 누적 점수 (서버와 공용)
src/f2/                    # /2    거리뷰 토론
  DiscussionStep/          #       의견 핀 + 공감
  useSpeechInput.js        #       음성 + 텍스트 fallback
  useSpeechOutput.js
  buildFollowUpQuestion.js #       AI 후속 질문 (로컬 대체 로직)
  fetchFollowUpQuestion.js
src/tracker/               # /tracker  2번 참가자용 웹캠 트래커
src/server/                # WebSocket 룸 (점수 누적, 승자 결정)
```
