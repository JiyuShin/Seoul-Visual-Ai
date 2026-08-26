# Visual AI Glass — Scene 2–3 Prototype

시선 기반 회의 주제 선택 → 대비 이미지 → 시선+보이스 의견 입력 → 시선 기반 공감(하트) 웹 프로토타입입니다.

## 실행

```bash
yarn install
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 사용 방법

1. **카메라 권한 허용** — WebGazer.js가 눈동자 추적에 웹캠을 사용합니다.
2. **시선 보정 (클릭 없음)** — 9개 점이 순서대로 나타납니다. **마우스를 쓰지 말고** 각 점을 **2.5초간 눈으로만** 바라보세요. "얼굴 인식됨"이 표시되어야 합니다.
3. **1단계 [vote]** — 5개 비전 카드 중 하나를 **3초간 응시**하면 선택됩니다. 점선 리티클이 **실제 시선**을 따라갑니다.
4. **2단계 [reveal]** — 선택된 비전 + 현재 서울 거리 대비 이미지 + AI 에이전트 대사
5. **3단계 [discussion]** — 거리 이미지의 지점을 1.2초간 응시하며 말하거나 텍스트 입력 → 의견 핀 생성. 다른 사람의 핀을 2초간 응시 → ♥ 공감
6. **4단계 [done]** — 수집된 핀 데이터 확인

## 기술 스택

- Next.js (Pages Router) + React (JavaScript)
- WebGazer.js — 웹캠 시선 추적
- Web Speech API — 음성 입력 (실패 시 텍스트 입력 fallback)
- CSS Modules

## 프로젝트 구조

```
src/scenes/EntryToDiscussion/
  index.jsx              # 상태머신 (vote → reveal → discussion → done)
  useGazeTracker.js      # WebGazer 초기화
  useSpeechInput.js      # 음성 + 텍스트 fallback
  gazeConfig.js          # 상수
  VoteStep/              # 비전 카드 선택
  RevealStep/            # 대비 이미지
  DiscussionStep/        # 의견 핀 + 하트
```
