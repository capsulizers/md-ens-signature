---
title: Mean reversion on BTC 4h
tags: [skill, trading]
signer: bob.mdsig91205.eth
signature: "0xa5830099edd3328107d1b6f36716ec3b59e08a5bcfba042897311cef85abe98b45cf4935df944059e6ec7545aa36c79391b004b8383a47548ec44922c05833f91c"
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
