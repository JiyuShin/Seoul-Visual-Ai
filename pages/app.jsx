import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function EntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pre_opening');
  }, [router]);

  return null;
}
