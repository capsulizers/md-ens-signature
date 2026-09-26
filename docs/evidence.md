# On-chain evidence

Every on-chain action behind the demo, on Sepolia (chain 11155111). Signing a
file is an off-chain wallet signature and has no transaction, so it is not
listed here.

## Parent name `mdsig91205.eth`

Registered by Alice `0x5D279927926977c28685C184C48fC72e31Bdb7D6` through the
ENSv2 ETHRegistrar, with its own UserRegistry
`0x01B491f24c5705b346482B402dC8665aCe4583a0` and PermissionedResolver
`0xCCb6bEf32EE256498ec3F9B19c6eBa1400cB74d1`.

| Step | Transaction |
| --- | --- |
| Deploy UserRegistry | [0x1a26ab4e…](https://sepolia.etherscan.io/tx/0x1a26ab4e9b45ec323afe9a0ab27a4f7ad8dbf374ad37032e0aebd8a4fac865f1) |
| Deploy PermissionedResolver | [0xbdd70efb…](https://sepolia.etherscan.io/tx/0xbdd70efb643c00da8eb1644b005ffe2688d81d546665c851b0aad61658fa9097) |
| Mint MockUSDC | [0xe8ebb7f2…](https://sepolia.etherscan.io/tx/0xe8ebb7f2ee73d5349f02b69329514be2ccabc7218849447ed847eb694a719d07) |
| Approve MockUSDC | [0x5e59c867…](https://sepolia.etherscan.io/tx/0x5e59c867d586b47727e89e64ee121c08bb0db0068bbfc0d9bcd9647c45d6c51d) |
| Commit | [0xc51ce5c2…](https://sepolia.etherscan.io/tx/0xc51ce5c286f21f8c2f6c3517268456a7f27ccd24d7d934c6d1f9c7e4322a87eb) |
| Register | [0xa437cfc6…](https://sepolia.etherscan.io/tx/0xa437cfc67de8af39718699d70c1e7fb651868b9089f5354c8f62e906e8828933) |
| Point the name at Alice | [0xf50f8ca3…](https://sepolia.etherscan.io/tx/0xf50f8ca3b6887dae077ca1433f85c28b5ddc91543b9cf566b86d12858befc5bd) |

## Members and roles

Read from the UserRegistry's `LabelRegistered`, `LabelUnregistered` and
`EACRolesChanged` logs. Times are UTC. `EACRolesChanged` with resource
`0x0` is a root role: `0x1001` is ROLE_REGISTRAR plus ROLE_UNREGISTER, the
right to add and revoke members.

| Time | Block | Event | Detail | Sender | Transaction |
| --- | --- | --- | --- | --- | --- |
| 2026-09-25T18:55:00Z | 11781145 | RegistryCreated |  | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x1a26ab4e9b…](https://sepolia.etherscan.io/tx/0x1a26ab4e9b45ec323afe9a0ab27a4f7ad8dbf374ad37032e0aebd8a4fac865f1) |
| 2026-09-25T18:55:00Z | 11781145 | EACRolesChanged | {"resource":"0x0","account":"0x5D279927926977c28685C184C48fC72e31Bdb7D6","oldRoleBitmap":"0x0","newRoleBitmap":"0x1111111111111111111111111111111111111111111111111111111111111111"} | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x1a26ab4e9b…](https://sepolia.etherscan.io/tx/0x1a26ab4e9b45ec323afe9a0ab27a4f7ad8dbf374ad37032e0aebd8a4fac865f1) |
| 2026-09-25T18:57:48Z | 11781159 | LabelRegistered | bob -> 0x5D279927926977c28685C184C48fC72e31Bdb7D6 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x9f74bb1783…](https://sepolia.etherscan.io/tx/0x9f74bb178310a5aac58868a9daedc2e503a6fe4ddb330edc4f86f8b0730c6b76) |
| 2026-09-25T18:57:48Z | 11781159 | EACRolesChanged | {"resource":"0x38e47a7b719dce63662aeaf43440326f551b8a7ee198cee35cb5d51700000000","account":"0x5D279927926977c28685C184C48fC72e31Bdb7D6","oldRoleBitmap":"0x0","newRoleBitmap":"0x1111111111111111111111111111111111111111111111111111111111111111"} | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x9f74bb1783…](https://sepolia.etherscan.io/tx/0x9f74bb178310a5aac58868a9daedc2e503a6fe4ddb330edc4f86f8b0730c6b76) |
| 2026-09-25T18:58:12Z | 11781161 | LabelUnregistered | token 0x38e47a7b719d… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x92e6c8ea29…](https://sepolia.etherscan.io/tx/0x92e6c8ea293e346aec2afcbe3488df154d798787bc6858132993fb98c7543ee1) |
| 2026-09-25T18:59:00Z | 11781165 | LabelRegistered | carol -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x6c02374a13…](https://sepolia.etherscan.io/tx/0x6c02374a133438872cd5e47351acd396829ceefab2dd99d5059980dc4e1b05a6) |
| 2026-09-25T18:59:12Z | 11781166 | LabelUnregistered | token 0x2c52130a69b3… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x4f27fa4130…](https://sepolia.etherscan.io/tx/0x4f27fa41309b5e0e97180dc188f249df450b739c89ddbbe9d75ceab3bfb9310a) |
| 2026-09-25T19:23:36Z | 11781281 | LabelRegistered | bob -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x135711c6c0…](https://sepolia.etherscan.io/tx/0x135711c6c0adb7b098f25bc3b1826583568990c2d97fc34b627795a89e44a4fa) |
| 2026-09-25T19:44:00Z | 11781380 | LabelRegistered | carol -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x8e30b571e3…](https://sepolia.etherscan.io/tx/0x8e30b571e35387b534f6439e30d37590dfdd855a475eea27af23447973330311) |
| 2026-09-25T19:44:12Z | 11781381 | LabelUnregistered | token 0x2c52130a69b3… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x6d615b2e3c…](https://sepolia.etherscan.io/tx/0x6d615b2e3c280abe87a2534470fc3ab48daaf29732e24a03e2485c08f552f221) |
| 2026-09-25T19:50:12Z | 11781407 | LabelRegistered | carol -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xa1c17c61c3…](https://sepolia.etherscan.io/tx/0xa1c17c61c314a8506568ba8dae704f668e7c2e3a7e7c1b14447ae50dfbc0c6b6) |
| 2026-09-25T19:50:36Z | 11781409 | LabelUnregistered | token 0x2c52130a69b3… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x094faa043c…](https://sepolia.etherscan.io/tx/0x094faa043c71fbe857b34f24cb38cbd56e3df4d89500a21ee98616800f7ce12d) |
| 2026-09-25T20:33:12Z | 11781616 | LabelUnregistered | token 0x38e47a7b719d… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x980c5d754b…](https://sepolia.etherscan.io/tx/0x980c5d754b403d23a171a2b24b60e9e7da3b9fc5a9cfecd703b64563a999fc9a) |
| 2026-09-25T20:39:48Z | 11781648 | LabelRegistered | bob -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xefc6376967…](https://sepolia.etherscan.io/tx/0xefc6376967b1c2c736a9db07c360b1ceb455ad1ab470fa3b42ec94dbbb9af5e9) |
| 2026-09-25T20:41:24Z | 11781655 | LabelUnregistered | token 0x38e47a7b719d… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x9d8867d700…](https://sepolia.etherscan.io/tx/0x9d8867d70056cf363722ee4f5e6efbf7dcb3cce39801008803082f7a93ba0c04) |
| 2026-09-25T20:43:12Z | 11781664 | LabelRegistered | bob -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xb250e90977…](https://sepolia.etherscan.io/tx/0xb250e90977af37b215a09de4607e956a6927c29ebb8d6778eb64991a010e1423) |
| 2026-09-25T20:56:00Z | 11781728 | LabelRegistered | qa -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x52f74594cf…](https://sepolia.etherscan.io/tx/0x52f74594cf39bc77f22247b96a728fd421336a5d34d088b55e7860e215f8d7c7) |
| 2026-09-25T20:58:48Z | 11781740 | LabelUnregistered | token 0xf21161c20bbd… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xdd4561042d…](https://sepolia.etherscan.io/tx/0xdd4561042d62c0e918c8414e1adac044191d6991d88bf665f07f8d1ee41f5011) |
| 2026-09-25T21:01:24Z | 11781753 | LabelRegistered | qa -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x070eba5e0c…](https://sepolia.etherscan.io/tx/0x070eba5e0c5f9b4e229d7d5fd79fc606c564bbe8192b08cd5faa6ce8483ec4fe) |
| 2026-09-25T21:30:24Z | 11781890 | LabelUnregistered | token 0xf21161c20bbd… | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xf38e26463d…](https://sepolia.etherscan.io/tx/0xf38e26463d226bebe30fb8f8f0028b2334f288b0ae02955dfc0a110de8923c77) |
| 2026-09-25T21:32:00Z | 11781898 | LabelRegistered | qa -> 0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xfb45a1108e…](https://sepolia.etherscan.io/tx/0xfb45a1108e52bab26b453042a84f90ec48fe7654b19f8cfc54ae6b7ca8458cd0) |
| 2026-09-26T02:15:36Z | 11783223 | LabelRegistered | eric -> 0xA2fD38B9FFbC6E3114670EFA6f6FB82976d31867 | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xeab60fd1aa…](https://sepolia.etherscan.io/tx/0xeab60fd1aa2a7c5908d3c518fc6b93736f0524a3038cfbcaf94955f16e504f52) |
| 2026-09-26T02:15:48Z | 11783224 | LabelRegistered | tom -> 0x81BcC20cEdB2Fb1Ac91cdd9288930Cb7DC481d7c | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0x0196112a79…](https://sepolia.etherscan.io/tx/0x0196112a79e8460921cc134ed9b845b580c176b0ea279c7e5756858de43bba96) |
| 2026-09-26T02:16:00Z | 11783225 | EACRolesChanged | {"resource":"0x0","account":"0xA2fD38B9FFbC6E3114670EFA6f6FB82976d31867","oldRoleBitmap":"0x0","newRoleBitmap":"0x1001"} | 0x5d279927926977c28685c184c48fc72e31bdb7d6 | [0xf3892061a6…](https://sepolia.etherscan.io/tx/0xf3892061a63a5efb78f6b969fa8ccf58f6f6562b969bf5f3163d207a5e332bc7) |

Bob, carol and qa were test members during development. The demo members are
`eric` and `tom`, and Eric holds the two member roles.

The same grant was sent a second time by mistake, when a setup script was
rerun: [0x66cbf595…](https://sepolia.etherscan.io/tx/0x66cbf595a7c2ae30a39bc84261d3b9457effd6d6439e4cd251751b9d8bd2571d),
block 11783241, from Alice. Eric already held both roles, so it emitted no
event and changed nothing.

## Test team `mdsigteam6488.eth`

Used only to test that a role holder, not the owner, can grant and revoke
from the page.

| What | Sender | Block | Transaction |
| --- | --- | --- | --- |
| Alice gives Bob ROLE_REGISTRAR and ROLE_UNREGISTER | Alice | 11783233 | [0xffc160d8…](https://sepolia.etherscan.io/tx/0xffc160d839f7f9d22e600dfd4da4674416ddfdfe87c1efe3369fbbb8fada29f1) |
| Bob grants `demo` to Mallory from the page | Bob `0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5` | 11783266 | [0x593f854a…](https://sepolia.etherscan.io/tx/0x593f854ae532aea0387a55cd8b27ffb6b5aa3b1ff7349963b80fd12f270689ca) |
| Bob revokes `demo` from the page | Bob | 11783268 | [0x524fee78…](https://sepolia.etherscan.io/tx/0x524fee781f5e23f49d129550b7a61aad9c314b04f42a07e1148fd4045e6738d1) |

## Simulations

These were `eth_call` simulations at block 11783225. No transaction was sent.

- Eric calling `unregister(tom)` would succeed.
- Tom calling `unregister(eric)` reverts, because Tom holds no registry role.
