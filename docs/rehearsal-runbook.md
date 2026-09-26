# Demo runbook

For the Memona 2.0.0-alpha.44 demo. Sepolia (chain 11155111). Team name
`mdsig91205.eth`, document name `skills.mdsig91205.eth`.

| Role | Who | Wallet | Tool |
| --- | --- | --- | --- |
| Eric | team admin, owns `eric.mdsig91205.eth`, may add and revoke members, publishes | `0xA2fD38B9FFbC6E3114670EFA6f6FB82976d31867` | Memona with his own key; the [live page](https://capsulizers.github.io/mdtp/) + MetaMask to revoke |
| Tom | member, owns `tom.mdsig91205.eth`, publishes | `0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` | Memona with his own key |
| Helen | reader, no key, no wallet | none | Memona and its Folder Agent |

Publishing is two Sepolia transactions from the publisher's own key: one
carries the Markdown, one points the name's `mdtp` record at it. Budget about
0.001 SepoliaETH per publish for Eric and Tom. Signing and reading are free.

## Setup

1. Install Memona 2.0.0-alpha.44 or newer from [memona.io](https://memona.io)
   on each laptop that plays a role.
2. Eric and Tom, each in their own Memona: Settings > Editor > Ethereum.
   - RPC URL: keep the default public Sepolia node.
   - ENS name: `eric.mdsig91205.eth` or `tom.mdsig91205.eth`.
   - Private key: the account's key exported from their own MetaMask
     (Account details > Show private key). Each person types their own key
     into their own Memona. Never send a key to anyone, and never paste one
     into a chat or a shared file. Memona keeps it on that device and shows
     only its address afterwards.
3. Helen: nothing under Ethereum. Reading and checking need no key.
4. Publish rights: Eric and Tom must be allowed to set the `mdtp` record of
   `skills.mdsig91205.eth`. Workstream C is granting both tonight with
   `authorizeTextRoles`; until that lands, Publish fails with "Check that your
   name may publish". Check on the live page, Sign tab > Permissions, that
   `eric` and `tom` show as Granted.
5. Everyone opens `mdtp://skills.mdsig91205.eth` once: type it in the path
   bar, or click the link in a browser, which opens Memona.
6. Files: `SKILL-v1.md`, `SKILL-v2.md`, `SKILL-v3.md` and `tokens.tsv` from
   `examples/demo/` in this repository. Eric keeps v1, Tom v2 and v3, each in
   a folder open in their Memona.
7. A plain shared folder for scene 3, for example with
   [rclone](https://rclone.org/downloads/):
   `rclone serve webdav C:\demo-dav --addr 127.0.0.1:8765`, added in Helen's
   Memona with the WebDAV connection (no signature plugin needed). Any folder
   that someone else can write works the same.
8. Helen's own workspace folder holds `tokens.tsv`, an empty `outputs/`, and
   the two files from `examples/demo/helen-workspace/`: `AGENTS.md` (the rule)
   and `CLAUDE.md` (which makes Claude Code load it). The rule reads a
   published document with `mdsig read`, so install the command there once:
   `cargo install --git https://github.com/capsulizers/mdtp mdsig`.

## Verdict gate

Memona judges a published document again when Helen sends a prompt. If it does
not read as Verified at that moment, Memona removes it from what the Folder
Agent receives, in code, before the agent starts. Helen's workspace rule then
makes the agent stop instead of looking elsewhere: it uses a skill only from
the `mdtp://` name Memona passes as the open file, reads it with
`mdsig read --json`, and continues only on `verified`. The rule lives in
Helen's own folder, so no publisher can remove it.

Helen's prompt for every scene, in a new conversation, with
`mdtp://skills.mdsig91205.eth` open: "Screen tokens.tsv with the open
token-screener skill and write outputs/report.md."

## The five scenes

The frontmatter row of a published document shows the verdict, the publisher
and the published time (UTC). Reopen the name after each
publish or revoke.

1. **Eric publishes v1.** Eric opens `SKILL-v1.md`, presses the send button
   beside Sign (Publish to Ethereum), keeps or types the document name
   `skills.mdsig91205.eth`, reads the warning at the pointer and confirms.
   After both transactions, Memona shows the `mdtp://` link and the
   transaction page. Helen opens `mdtp://skills.mdsig91205.eth`: Verified,
   publisher `eric.mdsig91205.eth`. The agent lists 5 candidates: NOVA, RUGY,
   KITE, LUMA, MOSS.
2. **Tom publishes v2 (adds RUGY to the risk list).** Tom opens `SKILL-v2.md`,
   presses Sign (the badge reads Verified), then Publish to the same name.
   The warning now says it replaces the current version for everyone. Helen
   reopens the name: Verified, publisher `tom.mdsig91205.eth`. The agent lists
   4 candidates: NOVA, KITE, LUMA, MOSS.
3. **A copy on a web folder is edited.** Tom copies his signed `SKILL-v2.md`
   into the shared WebDAV folder. Someone opens `C:\demo-dav\SKILL-v2.md` in
   Notepad and deletes the RUGY row. Helen opens that copy in Memona: the
   badge reads Tampered. She opens `mdtp://skills.mdsig91205.eth` again: still
   Verified, RUGY still listed. A web server can change a file; nobody can
   change the published transaction. (This replaces the old tamper scene.)
4. **Tom publishes v3 by mistake, Eric revokes Tom.** Tom publishes
   `SKILL-v3.md` (the RUGY row deleted) to the same name. Eric sees RUGY
   missing, opens the live page with MetaMask on his account, and in Sign tab
   > Permissions clicks Revoke on `tom.mdsig91205.eth`; wait for Revoked.
   Helen reopens the name: Unauthorized, publisher `tom.mdsig91205.eth`. Her
   prompt reaches the agent without the skill, and the agent stops and tells
   her. Tom's v2 is no better: the verdict asks who owns the publisher name
   now, so his on-chain v2 reads Unauthorized too (the live page's Read tab or
   Memona's Versions badge once they list older versions), and his signed copy
   reads Revoked.
5. **Eric republishes v2 as himself.** Eric opens `SKILL-v2.md`, presses Sign
   (the signer becomes `eric.mdsig91205.eth`), then Publish to
   `skills.mdsig91205.eth` and confirms the replace warning. Helen reopens the
   name: Verified, publisher `eric.mdsig91205.eth`. The agent lists 4
   candidates again.

## Reset

1. MetaMask: Eric. Live page, Sign tab > Permissions > Member label `tom`,
   Member address `0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c` > Grant. Wait
   for Granted. If Tom's publish right was granted to his address, it
   survives the revoke; check with a publish before the next run.
2. Scene 1 overwrites the record, so no on-chain undo is needed. Each run
   costs about four publishes of gas.
3. Put an unedited `SKILL-v2.md` back in the WebDAV folder and empty Helen's
   `outputs/`.

Never revoke `bob.mdsig91205.eth`; the README demo uses it.
