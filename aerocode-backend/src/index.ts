import 'dotenv/config'; // Ensures .env loads reliably
import express from 'express';
import cors from 'cors';
import generateRouter from './routes/generate.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());

app.use('/api/generate', generateRouter);

app.listen(PORT, () => {
  console.log(`🚀 Aerocode Agent Server running on http://localhost:${PORT}`);
});