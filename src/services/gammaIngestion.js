import crypto from 'node:crypto';
import db from '../config/db.js';

const GAMMA_API_URL = process.env.GAMMA_API_URL || 'https://gamma-api.polymarket.com';
const SPORTS_TAG_ID = process.env.POLYMARKET_SPORTS_TAG_ID || '1';
const PAGE_SIZE = 100;

//makes deterministic identifiers from source (market/event/category/outcome) and id
function uuidFor(source, id) {
  return crypto.createHash('sha1').update(`${source}:${id}`).digest('hex').replace(
    /^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5',
  );
}

//prevent invalid Date objects
function asDate(value) {
  if (!value) {
    return null;
  }
  
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

//sets event status to one of the enum types
function eventStatus(event) {
  if (event.closed || event.archived) {
    return 'COMPLETED';
  }

  if (event.live) {
    return 'LIVE';
  }

  return 'UPCOMING';
}

//sets market status to one of the enum types
function marketStatus(market) {
  if (market.closed) return 'CLOSED';
  return market.active === false ? 'CLOSED' : 'OPEN';
}

//get sports events from Gamma
async function fetchSportsEvents() {
  const events = [];
  let cursor;

  //loop for keyset pagination
  do {
    const params = new URLSearchParams({
      tag_id: SPORTS_TAG_ID,
      closed: 'false',
      limit: String(PAGE_SIZE),
    });

    //adds next page to params
    if (cursor) {
      params.set('after_cursor', cursor);
    }

    const response = await fetch(`${GAMMA_API_URL}/events/keyset?${params}`);
    if (!response.ok) throw new Error(`Gamma request failed with ${response.status}`);
    const page = await response.json();

    //append results to events array
    events.push(...(page.events || page.items || []));

    //get the next page of results
    cursor = page.next_cursor;

  //loop ends when Gamma returns the terminal cursor (LTE=)
  } while (cursor && cursor !== 'LTE=');

  //only return events that have a game ID
  return events.filter((event) => event.gameId != null);
}

//add the sports category to db if one doesn't exist
async function ensureSportsCategory() {
  const { rows } = await db.query(`
    INSERT INTO market_categories (id, name)
    VALUES ($1, 'Sports')
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE
    RETURNING id
  `, [uuidFor('category', 'sports')]);
  return rows[0].id;
}

//insert or update event pulled from Gamma
async function upsertEvent(event, categoryId) {
  const eventId = uuidFor('event', event.id);
  const result = await db.query(`
    INSERT INTO events
      (id, polymarket_id, category_id, title, description, slug, game_id, start_time, status, source_updated_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    ON CONFLICT (polymarket_id) DO UPDATE SET
      category_id = EXCLUDED.category_id, 
      title = EXCLUDED.title,
      description = EXCLUDED.description, 
      slug = EXCLUDED.slug,
      game_id = EXCLUDED.game_id, 
      start_time = EXCLUDED.start_time,
      status = EXCLUDED.status, 
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [
    eventId, 
    String(event.id), 
    categoryId, 
    event.title || event.slug || `Game ${event.id}`,
    event.description || null, 
    event.slug || null, 
    event.gameId,
    asDate(event.startTime || event.gameStartTime || event.startDate), 
    eventStatus(event),
    asDate(event.updatedAt),
  ]);
  //return the db event ID for use in syncSportsMarkets
  return result.rows[0].id;
}

//insert or update market pulled from Gamma
async function upsertMarket(market, eventId) {
  const marketId = uuidFor('market', market.id);
  const tokenIds = JSON.parse(market.clobTokenIds);
  const labels = JSON.parse(market.outcomes);
  const prices = JSON.parse(market.outcomePrices);
  const outcomeRows = [];

  const result = await db.query(`
    INSERT INTO markets
      (id, polymarket_id, event_id, question, slug, condition_id, type, status, closes_at, source_updated_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 'SINGLE', $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (polymarket_id) DO UPDATE SET
      event_id = EXCLUDED.event_id, 
      question = EXCLUDED.question,
      slug = EXCLUDED.slug, 
      condition_id = EXCLUDED.condition_id,
      status = EXCLUDED.status, 
      closes_at = EXCLUDED.closes_at,
      source_updated_at = EXCLUDED.source_updated_at, 
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `, [
    marketId, 
    String(market.id), 
    eventId, 
    market.question || market.slug || `Market ${market.id}`,
    market.slug || null, 
    market.conditionId || null, 
    marketStatus(market),
    asDate(market.endDate || market.endDateIso), 
    asDate(market.updatedAt),
  ]);

  //loop to pair each token with its corresponding label and price
  for (let index = 0; index < tokenIds.length; index += 1) {
    const price = Number(prices[index] ?? 0);

    //missing token ID or invalid price is skipped
    if (!tokenIds[index] || !Number.isFinite(price)) {
      continue;
    }

    //probability forced between 0 and 1 in case price is somehow outside the range
    const probability = Math.min(Math.max(price, 0), 1);
    const odds = 1 / probability;
    const outcomeId = uuidFor('outcome', tokenIds[index]);

    //every token becomes a row in market_outcomes
    await db.query(`
      INSERT INTO market_outcomes
        (id, market_id, label, odds, probability, polymarket_token_id, polymarket_price,
         baseline_probability, baseline_odds)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (polymarket_token_id) DO UPDATE SET
        market_id = EXCLUDED.market_id, 
        label = EXCLUDED.label,
        polymarket_price = EXCLUDED.polymarket_price,
        baseline_probability = EXCLUDED.baseline_probability,
        baseline_odds = EXCLUDED.baseline_odds
    `, [
      outcomeId, 
      result.rows[0].id, 
      labels[index] || `Outcome ${index + 1}`, 
      odds, 
      probability,
      tokenIds[index],
      probability,
      probability,
      odds
    ]);
    outcomeRows.push(tokenIds[index]);
  }
  //return the outcome rows for use in syncSportsMarkets
  return outcomeRows;
}

//syncs events in the db with those on Polymarket
export async function syncSportsMarkets() {
  const categoryId = await ensureSportsCategory();
  const events = await fetchSportsEvents();
  const tokenIds = [];
  for (const event of events) {
    const eventId = await upsertEvent(event, categoryId);
    //empty array as fallback
    for (const market of event.markets || []) {
      tokenIds.push(...await upsertMarket(market, eventId));
    }
  }
  //Set removes duplicate IDs
  //return token IDs for use in refreshing every minute
  return [...new Set(tokenIds)];
}