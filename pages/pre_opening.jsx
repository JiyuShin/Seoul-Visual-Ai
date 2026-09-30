import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import OpeningStill from '../src/op/OpeningStill';
import useOpeningPhase from '../src/op/useOpeningPhase';

export default function PreOpeningPage() {
  const router = useRouter();
  const phase = useOpeningPhase();

  useEffect(() => {
    if (phase === 'playing') router.replace('/1');
  }, [phase, router]);

  return (
    <>
      <Head>
        <title>Plant Your Seoul — Pre-opening</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </Head>
      <OpeningStill />
    </>
  );
}
