import { createServer } from 'node:http';
import next from 'next';
import { attachVoteRoom } from './src/server/voteRoom.js';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || 'localhost';

// Next.js를 커스텀 서버로 감싼다. 시선 좌표는 초당 수십 번 오가므로
// API Route 폴링 대신 같은 포트에 WebSocket을 붙인다.
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  handle(req, res);
});

const voteRoom = attachVoteRoom(server);

server.listen(port, () => {
  console.log(`> ready on http://${hostname}:${port}`);
  console.log(`> display: http://${hostname}:${port}/app`);
  console.log(`> tracker: http://${hostname}:${port}/tracker`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    voteRoom.close();
    server.close(() => process.exit(0));
  });
}
