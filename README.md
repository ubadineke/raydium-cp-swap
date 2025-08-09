# raydium-cp-swap

A revamped constant product AMM program optimized for straightforward pool deployment along with additional features and integrations:

- No Openbook market ID is required for pool creation
- Token22 is supported
- Built-in price oracle
- Optimized in Anchor

The program has been audited by [MadShield](https://www.madshield.xyz/). The report can be found [here](https://github.com/raydium-io/raydium-docs/tree/master/audit/MadShield%20Q1%202024).

The program assets are in-scope for Raydium’s [Immunefi bug bounty program](https://immunefi.com/bug-bounty/raydium/).

## Environment Setup

1. Install `Rust`

   ```shell
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default 1.81.0
   ```

2. Install `Solana `

   ```shell
   sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
   ```

   then run `solana-keygen new` to create a keypair at the default location.

3. install `Anchor`

   ```shell
   # Installing using Anchor version manager (avm)
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   # Install anchor
   avm install 0.31.0
   ```

## Quickstart

Clone the repository and test the program.

```shell

git clone https://github.com/raydium-io/raydium-cp-swap
cd raydium-cp-swap && yarn && anchor test
```

## License

Raydium constant product swap is licensed under the Apache License, Version 2.0.

## Transfer Hook Extensions and Permissionless Whitelist Governance

This fork extends the original Raydium constant product AMM with native support for SPL Token-2022 transfer hook extensions. Pools can be created and operated with tokens that implement a transfer hook, enabling on‑transfer logic such as fee routing, compliance checks, or analytics without modifying the AMM core.

- **What’s added**: end-to-end tests and client utilities demonstrating initialize/deposit/swap flows with Token‑2022 mints that have a transfer hook; support for extra account metas required by hook programs; and wiring that makes the AMM compatible with hook-enabled tokens alongside classic SPL tokens.
- **Permissionless governance**: approval of transfer hook programs is permissionless and community-driven. A separate governance program maintains a whitelist of approved hook program IDs. Anyone can propose a hook, and RAY token holders vote to approve or reject. The AMM consults this whitelist to accept only approved hook programs.
- **Whitelist controller program**: the whitelist governance lives in a dedicated repository. See `whitelist-hook-program` for the governance program, on-chain accounts, and example client flows: [whitelist-hook-program](https://github.com/ubadineke/whitelist-hook-program).

This design lets integrators adopt Token‑2022 transfer hooks safely, while keeping the AMM’s core logic simple and auditable. Approved hook programs can evolve independently via governance without requiring upgrades to the AMM itself.
