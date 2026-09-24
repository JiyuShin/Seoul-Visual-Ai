// 3페이지 q 순서와 같은 구 번호. 용산·성동 장면은 아직 주소가 없다.
const SCENES = {
  1: {
    name: '종로구',
    image: '/street/360/assets/boulevard-detail-panorama.webp',
  },
  4: {
    name: '마포구',
    image: '/street/360/assets/boulevard-detail-panorama.webp',
  },
  5: {
    name: '송파구',
    image: '/street/tower/assets/tower-panorama.webp',
  },
  6: {
    name: '강남구',
    image: '/street/360/assets/boulevard-detail-panorama.webp',
  },
};

export function streetSceneForDistrict(district) {
  const id = district?.id;
  const scene = SCENES[id];
  if (scene) return { ...scene, pending: false, id };
  if (id) {
    return {
      id,
      name: district.name || '이 구',
      image: '',
      pending: true,
    };
  }
  return { ...SCENES[1], pending: false, id: 1 };
}
