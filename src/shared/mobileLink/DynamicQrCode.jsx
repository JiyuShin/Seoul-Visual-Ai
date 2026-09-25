import { useEffect, useMemo, useState } from 'react';
import styles from './DynamicQrCode.module.css';

/**
 * @param {{ url: string, alt?: string }} props
 */
export default function DynamicQrCode({ url, alt = 'QR 코드' }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const src = useMemo(() => {
    if (!url) return '';
    return `/api/mobile-qr?url=${encodeURIComponent(url)}`;
  }, [url]);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (!url) {
    return null;
  }

  if (failed) {
    return (
      <p className={styles.error} role="alert">
        QR 생성 실패
        <br />
        <span className={styles.errorUrl}>{url}</span>
      </p>
    );
  }

  return (
    <>
      {!loaded ? <div className={styles.loading} aria-hidden="true" /> : null}
      <img
        className={styles.root}
        src={src}
        alt={alt}
        decoding="async"
        style={loaded ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}
