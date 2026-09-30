import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import OpeningStill from '../src/op/OpeningStill';
import useOpeningPhase from '../src/op/useOpeningPhase';

export default function StillPage() {
  const router = useRouter();
  const phase = useOpeningPhase();

  useEffect(() => {
    if (phase === 'playing') router.replace('/op');
  }, [phase, router]);

  return (
    <>
      <Head>
        <title>Plant Your Seoul — Still</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <OpeningStill />
    </>
  );
}
