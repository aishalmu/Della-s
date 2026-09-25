import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const password = process.env.APP_PASSWORD;
if (!password) {
  console.error('Set APP_PASSWORD before starting the server.');
  process.exit(1);
}

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const app = createApp({ password, distDir, trustProxy: process.env.TRUST_PROXY === '1' });
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Aisha’s Bible is running on port ${port}`));
