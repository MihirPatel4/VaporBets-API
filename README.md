# VaporBets (WIP)

VaporBets is a mobile app for simulated sports-betting using the virtual currency Vaporcredits. Users will be able to bet on live sports events with no real financial stakes.

## Market data

The app imports active Polymarket sports events using Gamma API every 60 seconds. Their markets and outcome token IDs are stored as the Polymarket baseline. User bets on this app will affect the final prices and market odds.
The CLOB market WebSocket updates best bid, best ask, last trade price, probability, and displayed odds in real time.

## Vaporcredits

Vaporcredits (VC) are the betting currency for this app. User accounts will receive 10,000 VC every week. VC cannot be exchanged for real-world currency.

## Points

User points allow for users to be ranked based on achievements and betting activity, rather than just the amount in their VC wallet.
Users earn points upon placing a bet. They receive 1% of the VC wagered in points, with a minimum of 100 VC needing to be wagered in order to earn a point. Upon winning a bet, the user receives an additional 1% of VC won.
Achievements will be a significant source of points for users. Additionally, users earn 10 points per calendar day logged in.

## Achievements

Achievements are permanent sources of points that can only be awarded once, with the exception of seasonal achievements. The points awarded by an achievement depend on its rarity.

| Achievement Rarity | Points Awarded |
| ------------------ | -------------- |
| Common             | +100           |
| Uncommon           | +200           |
| Rare               | +300           |
| Epic               | +500           |
| Legendary          | +1,000         |

## Leaderboards

Users will be able to see their rank in weekly regional, country, and worldwide leaderboards. The list can be sorted by points or VC balance.

## User Profiles

Each user will have a profile that displays sections for their best plays, achievements, and betting history.
