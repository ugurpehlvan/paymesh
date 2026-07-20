import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

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

app.get('/api/v1/users', async (req, res) => {
  try {
    const response = await axios.get('http://user-service:3000/users');
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({
      code: 'USER_SERVICE_ERROR',
      message: 'User service unreachable',
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(3000, () => {
  console.log('Service running on port 3000');
});