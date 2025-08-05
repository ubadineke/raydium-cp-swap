import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";

import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMint,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddressSync,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
  initializeTransferHook,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  setupInitializeTest,
  initialize,
  calculateFee,
  sendTransaction,
  createAmmConfig,
  initialize2,
  createMintWithTransferHook,
  createATAWithTransferHook,
  createTokenMintAndAssociatedTokenAccount2,
} from "./utils";
import { assert } from "chai";
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";
import { sleep } from "./swap.test";
import { error } from "console";

describe("initialize test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  console.log("owner: ", owner.publicKey.toString());

  const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;

  const confirmOptions: ConfirmOptions = {
    skipPreflight: true,
    // commitment: "confirmed",
  };

  it("create pool without fee", async () => {
    const { configAddress, token0, token0Program, token1, token1Program } =
      await setupInitializeTest(
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
        { transferFeeBasisPoints: 0, MaxFee: 0 },
        confirmOptions
      );

    const initAmount0 = new BN(10000000000);
    const initAmount1 = new BN(10000000000);
    const { poolAddress, poolState } = await initialize(
      program,
      owner,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      confirmOptions,
      { initAmount0, initAmount1 }
    );
    let vault0 = await getAccount(
      anchor.getProvider().connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    assert.equal(vault0.amount.toString(), initAmount0.toString());

    let vault1 = await getAccount(
      anchor.getProvider().connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );
    assert.equal(vault1.amount.toString(), initAmount1.toString());
  });

  it("create pool with fee", async () => {
    const { configAddress, token0, token0Program, token1, token1Program } =
      await setupInitializeTest(
        program,
        anchor.getProvider().connection,
        owner,
        {
          config_index: 0,
          tradeFeeRate: new BN(10),
          protocolFeeRate: new BN(1000),
          fundFeeRate: new BN(25000),
          create_fee: new BN(100000000),
        },
        { transferFeeBasisPoints: 0, MaxFee: 0 },
        confirmOptions
      );

    const initAmount0 = new BN(10000000000);
    const initAmount1 = new BN(10000000000);
    const { poolAddress, poolState } = await initialize(
      program,
      owner,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      confirmOptions,
      { initAmount0, initAmount1 }
    );
    let vault0 = await getAccount(
      anchor.getProvider().connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    assert.equal(vault0.amount.toString(), initAmount0.toString());

    let vault1 = await getAccount(
      anchor.getProvider().connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );
    assert.equal(vault1.amount.toString(), initAmount1.toString());
  });

  it("create pool with token2022 mint has transfer fee", async () => {
    const transferFeeConfig = { transferFeeBasisPoints: 100, MaxFee: 50000000 }; // %10
    const { configAddress, token0, token0Program, token1, token1Program } =
      await setupInitializeTest(
        program,
        anchor.getProvider().connection,
        owner,
        {
          config_index: 0,
          tradeFeeRate: new BN(10),
          protocolFeeRate: new BN(1000),
          fundFeeRate: new BN(25000),
          create_fee: new BN(100000000),
        },
        transferFeeConfig,
        confirmOptions
      );

    const initAmount0 = new BN(10000000000);
    const initAmount1 = new BN(10000000000);
    const { poolAddress, poolState } = await initialize(
      program,
      owner,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      confirmOptions,
      { initAmount0, initAmount1 }
    );
    let vault0 = await getAccount(
      anchor.getProvider().connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    if (token0Program == TOKEN_PROGRAM_ID) {
      assert.equal(vault0.amount.toString(), initAmount0.toString());
    } else {
      const total =
        vault0.amount +
        calculateFee(
          transferFeeConfig,
          BigInt(initAmount0.toString()),
          poolState.token0Program
        );
      assert(new BN(total.toString()).gte(initAmount0));
    }

    let vault1 = await getAccount(
      anchor.getProvider().connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );
    if (token1Program == TOKEN_PROGRAM_ID) {
      assert.equal(vault1.amount.toString(), initAmount1.toString());
    } else {
      const total =
        vault1.amount +
        calculateFee(
          transferFeeConfig,
          BigInt(initAmount1.toString()),
          poolState.token1Program
        );
      assert(new BN(total.toString()).gte(initAmount1));
    }
  });

  it("create pool with token2022 mint that transfer hook", async () => {
    const transferHookProgramId = new PublicKey(
      "9Xu3kAPes19s7xZcoJeMsuqSvNJ31CPyfsu66J3k3XGj"
    );

    const { configAddress, token0, token0Program, token1, token1Program } =
      await setupInitializeTest2(
        program,
        anchor.getProvider().connection,
        owner,
        {
          config_index: 0,
          tradeFeeRate: new BN(10),
          protocolFeeRate: new BN(1000),
          fundFeeRate: new BN(25000),
          create_fee: new BN(100000000),
        },
        // { transferFeeBasisPoints: 0, MaxFee: 0 },
        transferHookProgramId,
        confirmOptions
      );

    const initAmount0 = new BN(10000000000);
    const initAmount1 = new BN(10000000000);

    const { poolAddress, poolState } = await initialize(
      program,
      owner,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      // new PublicKey("EbgGM7FcLWekZa6D7N4Z17cf6Ju9M6RdipjxxxUNLmpR"),
      confirmOptions,
      { initAmount0, initAmount1 }
    ).catch((err) => {
      console.error({ message: "Error", err });
    });
    let vault0 = await getAccount(
      anchor.getProvider().connection,
      poolState.token0Vault,
      "processed",
      poolState.token0Program
    );
    assert.equal(vault0.amount.toString(), initAmount0.toString());

    let vault1 = await getAccount(
      anchor.getProvider().connection,
      poolState.token1Vault,
      "processed",
      poolState.token1Program
    );
    assert.equal(vault1.amount.toString(), initAmount1.toString());
  });
});

export async function setupInitializeTest2(
  program: Program<RaydiumCpSwap>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    create_fee: BN;
  },
  transferHookProgramId: PublicKey,
  confirmOptions?: ConfirmOptions
) {
  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccount2(
      connection,
      owner,
      new Keypair(),
      // transferFeeConfig
      transferHookProgramId
    );
  const configAddress = await createAmmConfig(
    program,
    connection,
    owner,
    config.config_index,
    config.tradeFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    config.create_fee,
    confirmOptions
  );
  return {
    configAddress,
    token0,
    token0Program,
    token1,
    token1Program,
  };
}
