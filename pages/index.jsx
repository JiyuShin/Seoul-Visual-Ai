import dynamic from 'next/dynamic';
import Head from 'next/head';

const EntryToDiscussion = dynamic(
  () => import('../src/scenes/EntryToDiscussion'),
  { ssr: false }
);

export default function Home() {
  return (
    <>
      <Head>
        <title>Visual AI Glass — Scene 2–3</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="시선 기반 회의 주제 선택 프로토타입" />
      </Head>
      <EntryToDiscussion />
    </>
  );
}
