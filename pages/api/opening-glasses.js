import { resetOpening, setGlassesWorn, snapshot } from '../../src/shared/opening/openingHub';

export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(snapshot());
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ message: 'GET or POST' });
    return;
  }

  const body = req.body ?? {};
  if (body.reset) {
    res.status(200).json(resetOpening());
    return;
  }

  res.status(200).json(setGlassesWorn(body.worn));
}
