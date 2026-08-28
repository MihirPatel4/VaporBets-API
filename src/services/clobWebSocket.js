import WebSocket from 'ws';
import db from '../config/db.js';

const CLOB_WS_URL = process.env.POLYMARKET_CLOB_WS_URL || 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
let socket;
let pingTimer;
let reconnectTimer;
let subscribedTokenIds = [];
let isStarted = false;

//validate price value and convert to Number
function numericPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 1 ? price : null;
}

//update last trade price and polymarket price
async function updatePrice(tokenId, fields) {
  //leave function if either field is not present
  if (!fields.last_trade_price && !fields.polymarket_price) {
    return;
  }

  await db.query(`
    UPDATE market_outcomes
    SET last_trade_price = COALESCE($1, last_trade_price),
        polymarket_price = COALESCE($2, polymarket_price),
        price_updated_at = CURRENT_TIMESTAMP
    WHERE polymarket_token_id = $3
  `, [
    fields.last_trade_price ?? null,
    fields.polymarket_price ?? null,
    tokenId,
  ]);
}

//update the order book quote and calculate probability/odds
async function updateQuote(tokenId, { bestBid, bestAsk }) {
  //probability = (best bid + best ask) / 2
  //odds = 2 / (best bid + best ask)
  await db.query(`
    UPDATE market_outcomes
    SET best_bid = COALESCE($1, best_bid),
        best_ask = COALESCE($2, best_ask),
        probability = CASE
          WHEN COALESCE($1, best_bid) IS NOT NULL
            AND COALESCE($2, best_ask) IS NOT NULL
          THEN (COALESCE($1, best_bid) + COALESCE($2, best_ask)) / 2
          ELSE probability
        END,
        odds = CASE
          WHEN COALESCE($1, best_bid) IS NOT NULL
            AND COALESCE($2, best_ask) IS NOT NULL
            AND (COALESCE($1, best_bid) + COALESCE($2, best_ask)) > 0
          THEN 2 / (COALESCE($1, best_bid) + COALESCE($2, best_ask))
          ELSE odds
        END,
        price_updated_at = CURRENT_TIMESTAMP
    WHERE polymarket_token_id = $3
  `, [bestBid, bestAsk, tokenId]);
}

//handle each incoming CLOB websocket message
async function handleMessage(message) {
  let event;

  //ignore invalid JSON
  try { 
    event = JSON.parse(message.toString()); 
  } 
  catch { 
    return; 
  }

  const eventType = event.event_type;

  switch (eventType) {
    //update best bid and best ask
    case 'best_bid_ask':
      await updateQuote(event.asset_id, {
        bestBid: numericPrice(event.best_bid),
        bestAsk: numericPrice(event.best_ask),
      });
      break;

    //update price, probability, and odds
    case 'last_trade_price': {
      const price = numericPrice(event.price);
      if (price !== null && price > 0) {
        //send changes to the db
        await updatePrice(event.asset_id, {
          last_trade_price: price, 
          polymarket_price: price, 
        });
      }
      break;
    }

    //handle price change event, which can contain multiple updates
    case 'price_change':
      for (const change of event.price_changes || []) {
        const fields = {};
        let bestBid;
        let bestAsk;

        //update only the fields included in each change

        if (change.best_bid != null) {
          bestBid = numericPrice(change.best_bid);
        }

        if (change.best_ask != null) {
          bestAsk = numericPrice(change.best_ask);
        }

        if (change.price != null) {
          const price = numericPrice(change.price);

          if (price !== null) {
            fields.polymarket_price = price;
          }
        }

        //send changes to the db
        if (Object.keys(fields).length) {
          await updatePrice(change.asset_id, fields);
        }
        if (bestBid !== undefined || bestAsk !== undefined) {
          await updateQuote(change.asset_id, { bestBid, bestAsk });
        }
      }

      break;

    //reads the best values as the last one in the list
    case 'book': {
      const bestBid = event.bids?.at(-1)?.price;
      const bestAsk = event.asks?.at(-1)?.price;

      //send changes to the db
      await updateQuote(event.asset_id, {
        bestBid: numericPrice(bestBid),
        bestAsk: numericPrice(bestAsk),
      });

      break;
    }
  }
}

export function updateClobSubscription(tokenIds) {
  //removes duplicates from new list of token IDs
  subscribedTokenIds = [...new Set(tokenIds)];

  //if connection is not open or token ID list is empty, leave the function
  if (socket?.readyState !== WebSocket.OPEN || !subscribedTokenIds.length) {
    return;
  }

  //request subscriptions for tokens
  socket.send(JSON.stringify({ assets_ids: subscribedTokenIds, operation: 'subscribe' }));
}

//create connection to CLOB websocket
export function startClobWebSocket() {
  //prevent duplicate startups
  if (isStarted) {
    return;
  }
  isStarted = true;

  const connect = () => {
    //create and open socket
    socket = new WebSocket(CLOB_WS_URL);
    socket.on('open', () => {
      //clear any previous ping timer
      clearInterval(pingTimer);
      //send ping every 10 seconds
      pingTimer = setInterval(() => socket?.send('PING'), 10000);

      //if token ID list is not empty, subscribe to those markets
      if (subscribedTokenIds.length) {
        socket.send(JSON.stringify({
          assets_ids: subscribedTokenIds,
          type: 'market',
          custom_feature_enabled: true,
        }));
      }
    });

    //pass incoming messages to handleMessage
    socket.on('message', (message) => {
      try {
        handleMessage(message);
      }
      catch (error) {
        console.error('CLOB update failed:', error);
      }
    });

    //reconnect to socket
    socket.on('close', () => {
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 5000);
    });
    
    socket.on('error', (error) => console.error('CLOB WebSocket error:', error.message));
  };
  connect();
}