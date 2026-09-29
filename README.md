# VaporBets API (WIP)

VaporBets is a mobile app for simulated sports-betting using the virtual currency Vaporcredits. This repo contains the API and internal logic for the app.

## Market data

The app imports active Polymarket sports events using Gamma API every 120 seconds. Their markets and outcome token IDs are stored as the Polymarket baseline. User bets on this app will affect the final prices and market odds.
The CLOB WebSocket from Polymarket updates best bid, best ask, last trade price, probability, and displayed odds in real time.

## Vaporcredits allowance

New accounts are granted 10,000 Vaporcredits upon registration. To grant 10,000 more to every account each Sunday, a cron job has to run the grant-weekly-credits script at `0 0 * * 0` in UTC. The date is recorded in the ledger_entries table, so a duplicate grant in the same week is not possible.

## User authentication

This API uses Neon's Managed Better Auth for its authentication. Users have to sign up with an email and password. Email verification is required at sign up using a verification code.

## Database structure and relationships

Vaporbets uses a PostgreSQL schema built around user accounts, market data, bets, wallet activity, and progression/leaderboard data.

- `users` is the user table. Each user has a single wallet record in `vaporcredits_wallets`, and can also have related records in `ledger_entries`, `bets`, `leaderboard_entries`, `locations`, and `user_achievements`.
- `market_categories` defines the categories for sports markets. Each category can contain many `events`, and each event can contain many `markets`.
- `markets` contains the questions users bet on.
- `market_outcomes` stores each possible answer for a market, along with odds, probability, and price data pulled from Polymarket.
- `bets` represents a user wager. A single bet can include multiple `bet_legs`, where each leg references one `market_outcome` and stores the odds at the time the bet was placed.
- `ledger_entries` records wallet changes such as sign-up grants, weekly allowance, payouts, and bet settlements.
- `leaderboards` holds the different leaderboards for different regions and scopes.
- `leaderboard_entries` tracks user rankings on a leaderboard.
- `achievements` and `user_achievements` store achievement definitions and which users have earned them.
- `locations` stores a user's optional country/region information and consent status.

The relationship chain is:

- `users` -> `vaporcredits_wallets` (1-to-1)
- `users` -> `locations` (1-to-1)
- `users` -> `ledger_entries`
- `market_categories` -> `events` -> `markets` -> `market_outcomes`
- `users` -> `bets`
- `bets` -> `bet_legs`
- `market_outcomes` -> `bet-legs`
- `users` -> `leaderboard_entries`
- `leaderboards` -> `leaderboard_entries`
- `users` -> `user_achievements`
- `achievements` -> `user_achievements`
