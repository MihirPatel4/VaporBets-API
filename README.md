# VaporBets API (WIP)

VaporBets is a mobile app for simulated sports-betting using the virtual currency Vaporcredits. Users will be able to bet on live sports events with no real financial stakes. This repository contains the API and internal logic for the app.

## Market data

The app imports active Polymarket sports events using Gamma API every 60 seconds. Their markets and outcome token IDs are stored as the Polymarket baseline. User bets on this app will affect the final prices and market odds.
The CLOB market WebSocket updates best bid, best ask, last trade price, probability, and displayed odds in real time.

## User authentication

This API uses Neon's Managed Better Auth for its authentication routes. Users will have to sign up with an email and password. Email verification is required at sign up using a verification code.
