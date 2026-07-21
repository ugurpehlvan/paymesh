import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@paymesh/config';

const app = express();
app.use(express.json());

// 🔥 Correlation ID middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', requestId as string);
  (req as any).requestId = requestId;
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`Wallet service is listening port:${config.port}`);
});