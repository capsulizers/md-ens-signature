---
title: Mean reversion on BTC 4h
tags: [skill, trading]
---
# Mean reversion on BTC 4h

A skill note for an agent that trades BTC/USDC on 4-hour candles.

## Rules

1. Compute the 20-period Bollinger Bands on the close.
2. Enter long when a candle closes below the lower band and RSI(14) is
   under 30.
3. Exit at the middle band, or after 6 candles, whichever comes first.
4. Risk at most 1% of the account per trade; stop at 1.5 ATR(14) below
   entry.

## Why sign it

Whoever runs this skill should know who wrote it. If anyone changes a
threshold above, the signature no longer matches the author's ENS name.
