const fs = require('fs');
const path = require('path');

function copyDirFiles(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`[copy-mediapipe] ${label} not found at ${sourceDir}, skipping`);
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of fs.readdirSync(sourceDir)) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }

  console.log(`[copy-mediapipe] ${label} copied to public/`);
  return true;
}

const root = path.join(__dirname, '..');

copyDirFiles(
  path.join(root, 'node_modules/@mediapipe/face_mesh'),
  path.join(root, 'public/mediapipe/face_mesh'),
  'MediaPipe face_mesh assets'
);

const webgazerSource = path.join(root, 'node_modules/webgazer/dist/webgazer.js');
const webgazerTarget = path.join(root, 'public/webgazer.js');

if (fs.existsSync(webgazerSource)) {
  fs.copyFileSync(webgazerSource, webgazerTarget);
  console.log('[copy-mediapipe] webgazer.js copied to public/');
} else {
  console.warn('[copy-mediapipe] webgazer.js not found, skipping');
}
