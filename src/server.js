import express from 'express';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Hello world!');
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});