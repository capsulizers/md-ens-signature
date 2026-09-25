---
title: Mean reversion on BTC 4h
tags: [skill, trading]
signer: carol.mdsig91205.eth
signature: "0xc425a138fc24aee4084fe2be35db659bc1dcea3fbe49980b0f695d52a488fb8777bc719a33d5bef4b232b7d4878f01163302736b73300c466db2a10f65a2225b1c"
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
