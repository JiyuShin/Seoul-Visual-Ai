import { VOTE_VIEWER_IDS } from '../gazeConfig';

// 카메라 한 대가 사람 한 명을 담당한다. A는 NABI, B는 SORA.
// UI 쪽에서 시선 엔진 훅을 끌어오지 않고 이 이름들만 쓸 수 있게 따로 둔다.
export const CAM_KEYS = ['A', 'B'];
export const VIEWER_BY_CAM = { A: VOTE_VIEWER_IDS[0], B: VOTE_VIEWER_IDS[1] };
export const PERSON_LABEL = { A: 'NABI', B: 'SORA' };
export const CAM_COLOR = { A: '#4caf6d', B: '#e08a3c' };
