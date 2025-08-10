import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";
import {
  setupSwapTest,
  setupSwapTest2,
  swap_base_input,
  swap_base_output,
  swap_base_output_2,
} from "./utils";
import { assert } from "chai";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { ConfirmOptions, PublicKey } from "@solana/web3.js";

describe("swap test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;

  const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;

  const confirmOptions: ConfirmOptions = {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  };

  before(async () => {
    //Create Fee Receiver
    const wSOLMint = new PublicKey("So11111111111111111111111111111111111111112");

    const pool_ata = await getOrCreateAssociatedTokenAccount(
      anchor.getProvider().connection,
      owner,
      wSOLMint,
      owner.publicKey,
      false,
      "processed",
      { skipPreflight: true }
    );

    console.log(pool_ata.address);
  });

  it("swap base input without transfer fee", async () => {
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const inputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    await sleep(1000);
    let amount_in = new BN(100000000);
    await swap_base_input(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_in,
      new BN(0)
    );
    const inputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    assert.equal(
      inputTokenAccountBefore.amount - inputTokenAccountAfter.amount,
      BigInt(amount_in.toString())
    );
  });

  it("swap base output without transfer fee", async () => {
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    await sleep(1000);
    let amount_out = new BN(100000000);
    await swap_base_output(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_out,
      new BN(10000000000000),
      confirmOptions
    );
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );
  });

  it("swap base output with transfer fee", async () => {
    const transferFeeConfig = { transferFeeBasisPoints: 5, MaxFee: 5000 }; // %5
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      transferFeeConfig
    );

    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    await sleep(1000);
    let amount_out = new BN(100000000);
    await swap_base_output(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_out,
      new BN(10000000000000),
      confirmOptions
    );
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );
  });

  it("swap base output with transfer hook", async () => {
    // const transferFeeConfig = { transferFeeBasisPoints: 5, MaxFee: 5000 }; // %5

    const transferHookProgramId = new PublicKey(
      "98jF4sUxDMvoRdfotY3wn7yZzq5Ct7sRaMWdSgkFqTaH"
    );

    const { configAddress, poolAddress, poolState, extraAccountMetaListPDA } =
      await setupSwapTest2(
        program,
        anchor.getProvider().connection,
        owner,
        {
          config_index: 0,
          tradeFeeRate: new BN(10),
          protocolFeeRate: new BN(1000),
          fundFeeRate: new BN(25000),
          create_fee: new BN(0),
        },
        transferHookProgramId
      );

    console.log("Got out of the swap test");
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    await sleep(1000);
    let amount_out = new BN(100000000);

    await swap_base_output_2(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_out,
      new BN(10000000000000),
      transferHookProgramId,
      extraAccountMetaListPDA,
      confirmOptions
    ).catch((err) => {
      console.error({ message: "Error", err });
    });
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );
  });
});

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
