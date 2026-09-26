# Demo runbook

For the 17:00 rehearsal. Sepolia (chain 11155111). Parent name `mdsig91205.eth`.

| Role | Who | Wallet | Tool |
| --- | --- | --- | --- |
| Eric | team admin, owns `eric.mdsig91205.eth`, may add and revoke members | `0xA2fD38B9FFbC6E3114670EFA6f6FB82976d31867` | [live page](https://capsulizers.github.io/mdtp/) + MetaMask |
| Tom | member, owns `tom.mdsig91205.eth` | `0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` | live page + MetaMask |
| Helen | Memona user, no wallet | none | Memona, the Signature plugin and the Folder Agent |

Signing is free: it is an off-chain wallet signature, not a transaction. Only
Eric's revoke and re-register are transactions, about 0.0002 SepoliaETH for
both.

## Before the rehearsal

1. Presenter laptop: Chrome with MetaMask holding the Eric and Tom accounts,
   network Sepolia. The team imports its own keys; nobody else needs them.
2. The shared WebDAV folder, for example with
   [rclone](https://rclone.org/downloads/):
   `rclone serve webdav C:\demo-dav --addr 127.0.0.1:8765`. Create
   `C:\demo-dav\token-screener\`. The skill Helen's agent uses is always
   `token-screener/SKILL.md` in it. In Chrome, turn on "Ask where to save each
   file" so each signed download can be saved there under that name.
3. Memona, alpha.43 or newer: Plugins > Browse > Signature > Install (0.1.1 or
   newer). Then Connections > Add connection > Signed WebDAV, named
   `Team skills`:
   - Server address `http://127.0.0.1:8765/`
   - ENS name and signing key: leave empty (Helen only verifies)
   - Trusted parent `mdsig91205.eth`
   - Allowed hosts `127.0.0.1` and `ethereum-sepolia-rpc.publicnode.com`
     (host names only, no port), Private network on
   - Agent access: Read only. With Off, the agent cannot see the connection.
   - Save, then press Reconnect if the connection shows Disconnected.
4. Helen's own workspace folder (local, not the shared folder) holds
   `tokens.tsv`, an empty `outputs/`, and the two files from
   `examples/demo/helen-workspace/`: `AGENTS.md` (the rule) and `CLAUDE.md`
   (which makes Claude Code load it). Pin the Folder Agent's model to Opus;
   smaller models followed the rule too, but Opus quoted verdicts cleanest.
5. From `examples/demo/` in this repository: `SKILL-v1.md`, `SKILL-v2.md`,
   `SKILL-v3.md` and `tokens.tsv`.
6. Check on the live page that Permissions shows `eric` and `tom` as Granted.

## Verdict gate

The plugin writes a line `ens-verification: "…"` into every Markdown file it
serves, to Memona's editor and to the Folder Agent alike, and replaces any such
line a file stores itself. Helen's workspace rule tells the agent to continue
only when that line starts with `Verified:`, and otherwise to stop and tell
Helen the verdict. The rule lives in Helen's own folder, so whoever edits the
shared skill cannot remove it.

Agent prompt for every scene: "Screen tokens.tsv with the token-screener
skill from the Team skills connection and write outputs/report.md."

## The five scenes

Memona caches each verdict for 30 seconds; a changed file is checked at once.
After a revoke, wait 30 seconds before Helen runs again.

1. **Eric signs v1.** MetaMask: Eric. Live page > Open file > `SKILL-v1.md`,
   Sign as `eric.mdsig91205.eth` > Sign with wallet. The page shows Verified.
   Download signed file > save as `token-screener/SKILL.md`. Helen runs the
   agent: 5 candidates, NOVA, RUGY, KITE, LUMA, MOSS.
2. **Tom signs v2 (adds RUGY).** MetaMask: Tom. Open `SKILL-v2.md`, sign as
   `tom.mdsig91205.eth`, save over `token-screener/SKILL.md`, and keep a copy
   outside the folder as `SKILL-v2-tom.md`. Helen runs: 4 candidates, NOVA,
   KITE, LUMA, MOSS.
3. **Someone edits the shared file.** Open `C:\demo-dav\token-screener\SKILL.md`
   in Notepad, delete the RUGY row, save. Helen runs: the badge reads
   `Tampered: signed as tom.mdsig91205.eth`, and the agent stops and alerts
   her. Put `SKILL-v2-tom.md` back as `token-screener/SKILL.md`.
4. **Tom signs v3 by mistake, Eric revokes Tom.** MetaMask: Tom. Open
   `SKILL-v3.md` (the RUGY row deleted), sign as `tom.mdsig91205.eth`, save
   over `token-screener/SKILL.md`, and keep a copy as `SKILL-v3-tom.md`.
   Eric opens that file on the live page, sees RUGY missing, switches MetaMask
   to Eric, and in Permissions clicks Revoke on `tom.mdsig91205.eth`; wait for
   Revoked. Helen runs: `Unauthorized: tom.mdsig91205.eth is not registered`,
   and the agent stops and alerts her. Put `SKILL-v2-tom.md` back: it is
   Unauthorized too, because verification asks who owns the name now.
5. **Eric re-signs v2.** MetaMask: Eric. Open `SKILL-v2-tom.md` on the live
   page, change Sign as to `eric.mdsig91205.eth`, Sign with wallet, save over
   `token-screener/SKILL.md`. Helen runs: Verified, 4 candidates again.

## Reset

1. MetaMask: Eric. Permissions > Member label `tom`, Member address
   `0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` > Grant. Wait for Granted.
2. Put Eric's signed v1 back as `token-screener/SKILL.md`, or leave the shared
   file for scene 1 to overwrite.
3. Empty Helen's `outputs/`.

Signed files from an earlier run stay valid while their signer is a member, so
re-signing is only needed for files whose signer was revoked. Never revoke
`bob.mdsig91205.eth`; the README demo uses it.
