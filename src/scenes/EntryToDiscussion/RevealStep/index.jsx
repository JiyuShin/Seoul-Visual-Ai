import { useEffect, useState } from 'react';
import { AGENT_DIALOGUE, REVEAL_AGENT_DIALOGUE_MS } from '../gazeConfig';
import VisionCard from '../VoteStep/VisionCard';
import ContrastImage from './ContrastImage';
import styles from './RevealStep.module.css';

export default function RevealStep({ winnerCard, onComplete }) {
  const [showImage, setShowImage] = useState(false);
  const [showDialogue, setShowDialogue] = useState(false);
  const [dialogueDone, setDialogueDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowImage(true), 600);
    const t2 = setTimeout(() => setShowDialogue(true), 1400);
    const t3 = setTimeout(() => setDialogueDone(true), 1400 + REVEAL_AGENT_DIALOGUE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (!dialogueDone) return undefined;
    const t = setTimeout(() => onComplete?.(), 800);
    return () => clearTimeout(t);
  }, [dialogueDone, onComplete]);

  useEffect(() => {
    if (!showDialogue || typeof window === 'undefined') return undefined;
    if (!('speechSynthesis' in window)) return undefined;

    const utterance = new SpeechSynthesisUtterance(AGENT_DIALOGUE);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }, [showDialogue]);

  return (
    <section className={styles.revealStep}>
      <div className={styles.winnerArea}>
        <VisionCard card={winnerCard} intensity={1} isWinner compact />
        <p className={styles.winnerLabel}>{winnerCard.label}</p>
      </div>

      <ContrastImage visible={showImage} />

      <div className={`${styles.dialogue} ${showDialogue ? styles.visible : ''}`}>
        <span className={styles.agentTag}>AI Agent</span>
        <p className={styles.dialogueText}>{AGENT_DIALOGUE}</p>
      </div>
    </section>
  );
}
