/** @typedef {{ drawingUrl?: string | null, plantName?: string, plantImage?: string, plantVariant?: string, sent?: boolean }} SlotPlant */

/** @typedef {{ A?: SlotPlant, B?: SlotPlant }} SlotPlantsMap */

/**
 * @param {SlotPlantsMap} prev
 * @param {'A' | 'B'} slot
 * @param {{ type?: string, drawingUrl?: string | null, plantName?: string }} payload
 */
export function mergeSlotPlantFromState(prev, slot, payload) {
  if (slot !== 'A' && slot !== 'B') return prev;
  const type = payload?.type;
  if (type !== 'plant_drawing' && type !== 'plant_sent') return prev;

  const current = prev[slot] ?? {};
  const next = { ...current };

  if (type === 'plant_drawing' && payload.drawingUrl) {
    next.drawingUrl = payload.drawingUrl;
  }
  if (type === 'plant_sent') {
    next.sent = true;
    if (typeof payload.plantImage === 'string' && payload.plantImage) {
      next.plantImage = payload.plantImage;
    }
    if (typeof payload.plantVariant === 'string' && payload.plantVariant) {
      next.plantVariant = payload.plantVariant;
    }
  }
  if (typeof payload.plantName === 'string' && payload.plantName.trim()) {
    next.plantName = payload.plantName.trim();
  }

  if (
    next.drawingUrl === current.drawingUrl &&
    next.plantName === current.plantName &&
    next.sent === current.sent &&
    next.plantImage === current.plantImage &&
    next.plantVariant === current.plantVariant
  ) {
    return prev;
  }
  return { ...prev, [slot]: next };
}

export function bothSlotsHaveDrawing(slotPlants) {
  return Boolean(slotPlants?.A?.drawingUrl && slotPlants?.B?.drawingUrl);
}

/** 모바일 END 화면에서 전송(plant_sent)까지 둘 다 완료 */
export function bothSlotsHaveSent(slotPlants) {
  return Boolean(
    slotPlants?.A?.sent &&
      slotPlants?.B?.sent &&
      slotPlants?.A?.drawingUrl &&
      slotPlants?.B?.drawingUrl
  );
}

/** QR·접속만 완료 (슬롯 A·B 모두 연결) */
export function bothSlotsConnected(slots) {
  return Boolean(slots?.A && slots?.B);
}
