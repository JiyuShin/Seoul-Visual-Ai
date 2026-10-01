import styles from './PlantCards.module.css';

// 자치구마다 카드 2장. 왼쪽이 초록(NABI·슬롯 A), 오른쪽이 보라(SORA·슬롯 B).
const CARDS = {
  마포구: ['/5/cards/mapo-1.svg', '/5/cards/mapo-2.svg'],
};

export default function PlantCards({ visible, district }) {
  const cards = CARDS[district] || [];
  if (!cards.length) return null;

  return (
    <div className={`${styles.cardLayer} ${visible ? styles.cardLayerOn : ''}`}>
      {cards.map((src) => (
        <img key={src} className={styles.card} src={src} alt="" />
      ))}
    </div>
  );
}
