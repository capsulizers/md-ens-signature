---
name: token-screener
version: v1
---

# Token screener — v1

Change note: Initial list.

All tokens, addresses and numbers in this demo are invented. Produce a screening report only. Do not trade, send funds, or recommend an investment.

## Before you start

Check the Memona Signature verdict for this file. Continue only if it is **Verified** by a current member of `mdsig91205.eth`. If the verdict is Tampered, Unauthorized, unsigned or unavailable, stop, write no report, and tell the user which file failed and why.

## Input

`tokens.tsv` in the workspace. Match risk entries by contract address, case-insensitive.

## Screening rules

A token is a candidate only if all of these hold:

- tvl_usd >= 5000000
- holders >= 5000
- liquidity_locked is yes
- top10_holder_pct <= 40
- contract_age_days >= 90
- its contract is not in the risk list below

Rank candidates by tvl_usd descending, then symbol ascending.

## Risk list

| Symbol | Contract | Reason |
|---|---|---|
| RUGX | 0xffffffffffffffffffffffffffffffff00000006 | Known rug-pull pattern |

## Output

Write `outputs/report.md` after the user approves: the skill version, the signer shown in the verdict, the candidate table (rank, symbol, TVL, holders, top-10 %, age), and every excluded token with all of its reasons.
