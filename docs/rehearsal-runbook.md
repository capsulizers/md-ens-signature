# Demo runbook

For the 17:00 rehearsal. Sepolia (chain 11155111). Parent name `mdsig91205.eth`.

| Role | Who | Wallet | Tool |
| --- | --- | --- | --- |
| Eric | team admin, owns `eric.mdsig91205.eth`, may add and revoke members | `0xA2fD38B9FFbC6E3114670EFA6f6FB82976d31867` | [live page](https://capsulizers.github.io/md-ens-signature/) + MetaMask |
| Tom | member, owns `tom.mdsig91205.eth` | `0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` | live page + MetaMask |
| Helen | Memona user, no wallet | none | Memona + Signature plugin |

Signing is free (an off-chain wallet signature). Only Eric's grant and revoke
are transactions, about 0.0002 SepoliaETH for one revoke plus re-grant.

## Before the rehearsal

1. Presenter laptop: Chrome with MetaMask holding the Eric and Tom accounts,
   network Sepolia. The team imports its own keys; nobody else needs them.
2. A local WebDAV folder for Helen, for example with
   [rclone](https://rclone.org/downloads/):
   `rclone serve webdav C:\demo-dav --addr 127.0.0.1:8765`.
   Set Chrome's download folder to `C:\demo-dav`, and turn on "Ask where to
   save each file" so each download can be named `SKILL.md`.
3. Memona: Plugins > Browse > Signature > Install (version 0.1.1 or newer).
   Then Connections > Add connection > Signed WebDAV:
   - Server address `http://127.0.0.1:8765/`
   - ENS name and signing key: leave empty (Helen only verifies)
   - Trusted parent `mdsig91205.eth`
   - Allowed hosts `127.0.0.1` and `ethereum-sepolia-rpc.publicnode.com`,
     Private network on
4. Download the placeholder skills from `examples/demo/` in this repository:
   `SKILL-v1.md`, `SKILL-v2.md`, `SKILL-v3.md`.
5. Check that Tom is a member: on the live page, Permissions shows
   `tom.mdsig91205.eth` as Granted. If not, do "Reset" below.

## The four scenes

Memona caches each verdict for 30 seconds; a new file is checked at once.

1. **Eric signs v1.** MetaMask: Eric. Live page > Open file > `SKILL-v1.md`.
   Sign as `eric.mdsig91205.eth` > Sign with wallet > approve in MetaMask. The
   page shows Verified. Download signed file > save as `SKILL.md`.
   Helen opens `SKILL.md` in Memona: `ens-verification: Verified:
   eric.mdsig91205.eth`.
2. **Tom signs v2 (adds RUGY).** MetaMask: Tom. Open `SKILL-v2.md`, sign as
   `tom.mdsig91205.eth`, download over `SKILL.md`, and also keep a copy as
   `SKILL-v2-signed.md` outside the folder. Helen reopens: `Verified:
   tom.mdsig91205.eth`.
3. **One character changes.** Helen changes one character of the body in
   Memona (for example `5000000` to `5000001`) and saves. The badge turns
   `Tampered: signed as tom.mdsig91205.eth`. Put `SKILL-v2-signed.md` back as
   `SKILL.md` afterwards.
4. **Eric revokes Tom, Tom signs v3.** MetaMask: Eric. Permissions > row
   `tom.mdsig91205.eth` > Revoke > confirm; wait for Revoked (about 15 s).
   MetaMask: Tom. Open `SKILL-v3.md`, sign as `tom.mdsig91205.eth`: the page
   already shows Unauthorized. Download over `SKILL.md`. Helen reopens:
   `Unauthorized: tom.mdsig91205.eth is not registered`.

Say this in scene 4: revoking Tom also turns his earlier v2 Unauthorized.
Verification asks who owns the name now, so Tom's old signatures lose their
standing with his membership. Eric's v1 stays Verified.

## Reset

MetaMask: Eric. Permissions > Member label `tom`, Member address
`0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` > Grant. Tom's v2 is Verified
again. Never revoke `bob.mdsig91205.eth`; the README demo uses it.
