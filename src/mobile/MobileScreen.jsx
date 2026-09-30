import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntryFlow } from '../shared/EntryFlowContext';
import MobileDrawingPage from './MobileDrawingPage';
import MobileConvertPage from './MobileConvertPage';
import MobileConvertShader from './MobileConvertShader';
import MobileEndPage from './MobileEndPage';
import MobileLoadingPage from './MobileLoadingPage';
import MobilePlantVideo from './MobilePlantVideo';
import MobileSavePage from './MobileSavePage';
import MobileTag2Page from './MobileTag2Page';
import MobileTagPage from './MobileTagPage';
import { MOBILE_LOADING_ARTBOARD } from './mobileConfig';
import { MOBILE_PHASE } from './mobilePhases';
import { MobileStage } from './MobileStage';
import {
  DRAWING_TO_SAVE_MS,
  LOADING_TO_DRAWING_MS,
  SAVE_TO_TAG_MS,
  TAG2_TO_CONVERT_MS,
  CONVERT_HOLD_MS,
  CONVERT_TO_END_MS,
} from './mobileTransition';
import { useMobileLink } from '../shared/mobileLink/MobileLinkContext';
import { resolveMobileDistrictCopy } from './mobileDistrictCopy';
import { pickEndPlantVariant } from './mobileEndPlantVariants';
import styles from './MobileScreen.module.css';

export default function MobileScreen() {
  const { districtFromKiosk } = useMobileLink();
  const { selectedDistrict } = useEntryFlow();
  const districtName =
    districtFromKiosk?.name ?? selectedDistrict?.name ?? '용산구';
  const districtCopy = useMemo(
    () => resolveMobileDistrictCopy(districtName),
    [districtName]
  );
  const [phase, setPhase] = useState(MOBILE_PHASE.LOADING);
  const [loadingMounted, setLoadingMounted] = useState(true);
  const [loadingExit, setLoadingExit] = useState(false);
  const [bgBrighten, setBgBrighten] = useState(false);
  const [bgHeavyBlur, setBgHeavyBlur] = useState(false);
  const completedRef = useRef(false);

  const [drawingMounted, setDrawingMounted] = useState(false);
  const [drawingEnterFromLoading, setDrawingEnterFromLoading] = useState(false);
  const [drawingExit, setDrawingExit] = useState(false);

  const [saveMounted, setSaveMounted] = useState(false);
  const [saveExit, setSaveExit] = useState(false);

  const [tag2Mounted, setTag2Mounted] = useState(false);
  const [tag2Exit, setTag2Exit] = useState(false);

  const [convertMounted, setConvertMounted] = useState(false);
  const [convertExit, setConvertExit] = useState(false);

  const [plantDrawingUrl, setPlantDrawingUrl] = useState(null);
  const [plantName, setPlantName] = useState('');
  const [endPlantVariant, setEndPlantVariant] = useState(null);

  const goDrawing = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setBgBrighten(true);
    setLoadingExit(true);
    setPhase(MOBILE_PHASE.DRAWING);
    setDrawingEnterFromLoading(true);
    setDrawingMounted(true);
    window.setTimeout(() => {
      setLoadingMounted(false);
      setLoadingExit(false);
      setBgBrighten(false);
      setDrawingEnterFromLoading(false);
    }, LOADING_TO_DRAWING_MS);
  }, []);

  const goSave = useCallback((dataUrl) => {
    setPlantDrawingUrl(dataUrl ?? null);
    setDrawingExit(true);
    setPhase(MOBILE_PHASE.SAVE);
    setSaveMounted(true);
    window.setTimeout(() => {
      setDrawingMounted(false);
      setDrawingExit(false);
    }, DRAWING_TO_SAVE_MS);
  }, []);

  const goTag = useCallback(() => {
    setBgHeavyBlur(true);
    setSaveExit(true);
    setPhase(MOBILE_PHASE.TAG);
    window.setTimeout(() => {
      setSaveMounted(false);
      setSaveExit(false);
    }, SAVE_TO_TAG_MS);
  }, []);

  const goTag2 = useCallback(() => {
    setPhase(MOBILE_PHASE.TAG2);
    setTag2Mounted(true);
  }, []);

  const goConvert = useCallback(
    (confirmedName) => {
      const nextName = confirmedName?.trim() || plantName.trim();
      if (!nextName) return;
      setPlantName(nextName);
      setTag2Exit(true);
      setPhase(MOBILE_PHASE.CONVERT);
      window.setTimeout(() => {
        setTag2Mounted(false);
        setTag2Exit(false);
        setConvertMounted(true);
      }, TAG2_TO_CONVERT_MS);
    },
    [plantName]
  );

  const goEnd = useCallback(() => {
    setEndPlantVariant(pickEndPlantVariant(districtName));
    // 전송(END) 화면에서는 Figma처럼 깔끔한 그라디언트 배경(영상/강블러 없음)
    setBgHeavyBlur(false);
    setConvertExit(true);
    setPhase(MOBILE_PHASE.END);
    window.setTimeout(() => {
      setConvertMounted(false);
      setConvertExit(false);
    }, CONVERT_TO_END_MS);
  }, [districtName]);

  useEffect(() => {
    if (phase !== MOBILE_PHASE.CONVERT || !convertMounted) return undefined;
    const advance = window.setTimeout(() => {
      goEnd();
    }, CONVERT_HOLD_MS);
    return () => window.clearTimeout(advance);
  }, [phase, convertMounted, goEnd]);

  const { width, height } = MOBILE_LOADING_ARTBOARD;

  const showPlantVideo =
    phase === MOBILE_PHASE.LOADING ||
    phase === MOBILE_PHASE.DRAWING ||
    phase === MOBILE_PHASE.SAVE ||
    phase === MOBILE_PHASE.TAG ||
    phase === MOBILE_PHASE.TAG2 ||
    phase === MOBILE_PHASE.CONVERT;

  return (
    <div className={styles.mobileRoot}>
      <div className={styles.backdropLayer} aria-hidden="true">
        {showPlantVideo && <MobilePlantVideo onEnded={goDrawing} />}
        <div
          className={`${styles.backdropGradient} ${
            loadingMounted ? styles.backdropGradientLoading : ''
          } ${loadingExit ? styles.backdropGradientLoadingExit : ''} ${
            phase === MOBILE_PHASE.END ? styles.backdropGradientEnd : ''
          }`}
        />
        <div className={`${styles.bgBrighten} ${bgBrighten ? styles.bgBrightenActive : ''}`} />
        <div
          className={`${styles.bgHeavyBlur} ${bgHeavyBlur ? styles.bgHeavyBlurActive : ''} ${
            phase === MOBILE_PHASE.TAG ||
            phase === MOBILE_PHASE.TAG2 ||
            phase === MOBILE_PHASE.CONVERT
              ? styles.bgHeavyBlurSoft
              : ''
          }`}
        />
        {(phase === MOBILE_PHASE.CONVERT || convertMounted) && (
          <MobileConvertShader fading={phase !== MOBILE_PHASE.CONVERT} />
        )}
      </div>
      <MobileStage width={width} height={height} fit="contain">
        <div className={styles.session}>
        {loadingMounted && (
          <div
            className={`${styles.layer} ${styles.layerLoading} ${
              loadingExit ? styles.layerLoadingExit : ''
            }`}
          >
            <MobileLoadingPage
              districtName={districtName}
              loadingLead={districtCopy.loadingLead}
              exiting={loadingExit}
            />
          </div>
        )}
        {drawingMounted && (
          <div
            className={`${styles.layer} ${styles.layerDrawing} ${
              drawingExit ? styles.layerDrawingExit : ''
            }`}
          >
            <MobileDrawingPage
              districtName={districtName}
              drawingLeadLines={districtCopy.drawingLeadLines}
              tags={districtCopy.tags}
              enterFromLoading={drawingEnterFromLoading}
              exiting={drawingExit}
              onNext={goSave}
            />
          </div>
        )}
        {saveMounted && (
          <div
            className={`${styles.layer} ${styles.layerSave} ${saveExit ? styles.layerSaveExit : ''}`}
          >
            <MobileSavePage
              districtName={districtName}
              drawingLeadLines={districtCopy.drawingLeadLines}
              tags={districtCopy.tags}
              enterFromDrawing={!saveExit}
              exiting={saveExit}
              drawingUrl={plantDrawingUrl}
              drawingLayerVisible={drawingMounted}
              onComplete={goTag}
            />
          </div>
        )}
        {phase === MOBILE_PHASE.TAG && (
          <div className={`${styles.layer} ${styles.layerTag}`}>
            <MobileTagPage enterFromSave onStartNaming={goTag2} />
          </div>
        )}
        {tag2Mounted && (
          <div
            className={`${styles.layer} ${styles.layerTag} ${
              tag2Exit ? styles.layerTagExit : ''
            }`}
          >
            <MobileTag2Page
              plantName={plantName}
              exiting={tag2Exit}
              onPlantNameChange={setPlantName}
              onConfirmName={goConvert}
            />
          </div>
        )}
        {convertMounted && (
          <div
            className={`${styles.layer} ${styles.layerConvert} ${
              convertExit ? styles.layerConvertExit : ''
            }`}
          >
            <MobileConvertPage
              plantName={plantName}
              drawingUrl={plantDrawingUrl}
              enterFromTag
              exiting={convertExit}
            />
          </div>
        )}
        {phase === MOBILE_PHASE.END && (
          <div className={`${styles.layer} ${styles.layerEnd}`}>
            <MobileEndPage
              plantName={plantName}
              plantVariant={endPlantVariant}
              enterFromTag
              onSend={() => {}}
            />
          </div>
        )}
        </div>
      </MobileStage>
    </div>
  );
}
