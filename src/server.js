import express from 'express';
import { createServer } from 'node:http';
import authRoutes from './routes/authRoutes.js';
import betRoutes from './routes/betRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import { syncSportsMarkets } from './services/gammaIngestion.js';
import { startClobWebSocket, updateClobSubscription } from './services/clobWebSocket.js';
import { attachLiveUpdates } from './services/liveUpdates.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use('/auth', authRoutes);
app.use('/bets', betRoutes);
app.use('/events', eventRoutes);

app.get('/', (req, res) => {
  res.send('VaporBets API');
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: 'Internal server error' });
});

attachLiveUpdates(server);
server.listen(PORT, () => {
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
setInterval(refreshSportsMarkets, 120000);