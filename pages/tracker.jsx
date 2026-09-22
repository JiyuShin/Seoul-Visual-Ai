import TrackerScreen from '../src/tracker/TrackerScreen';

export default function TrackerPage() {
  return <TrackerScreen />;
}

// 공용 EntryFlowProvider가 WebGazer를 먼저 띄우면 이 페이지가 카메라를 고를 수 없다.
TrackerPage.skipEntryFlow = true;
