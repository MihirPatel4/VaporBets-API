import express from 'express';
import authRoutes from './routes/authRoutes.js';
import { syncSportsMarkets } from './services/gammaIngestion.js';
import { startClobWebSocket, updateClobSubscription } from './services/clobWebSocket.js';

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

async function refreshSportsMarkets() {
  try {
    const tokenIds = await syncSportsMarkets();
    updateClobSubscription(tokenIds);
    console.log(`Synced ${tokenIds.length} sports outcome tokens from Gamma`);
  } 
  catch (error) {
    console.error('Sports market sync failed:', error);
  }
}

startClobWebSocket();
await refreshSportsMarkets();
setInterval(refreshSportsMarkets, 60000);