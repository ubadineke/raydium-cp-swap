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
      "DrWbQtYJGtsoRwzKqAbHKHKsCJJfpysudF39GBVFSxub"
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
    console.log("passed everything");

    const initAmount0 = new BN(10000000000);
    const initAmount1 = new BN(10000000000);

    const { poolAddress, poolState } = await initialize2(
      program,
      owner,
      configAddress,
      token0,
      token0Program,
      token1,
      token1Program,
      new PublicKey("EbgGM7FcLWekZa6D7N4Z17cf6Ju9M6RdipjxxxUNLmpR"),
      confirmOptions,
      { initAmount0, initAmount1 }
    ).catch((err) => {
      console.error({ message: "Error", err });
    });
    console.log("one of many");
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

async function createMintWithTransferHook(
  connection: Connection,
  payer: Signer,
  mintAuthority: Signer,
  mintKeypair = Keypair.generate(),
  transferHookProgramId: PublicKey
) {
  const extensions = [ExtensionType.TransferHook];

  const mintLen = getMintLen(extensions);

  const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  // const mint_signature = await initializeTransferHook(
  //   connection,
  //   payer,
  //   mintKeypair.publicKey,
  //   mintAuthority.publicKey,
  //   transferHookProgramId,
  //   {
  //     skipPreflight: true,
  //     commitment: "confirmed",
  //     preflightCommitment: "confirmed",
  //   },
  //   TOKEN_2022_PROGRAM_ID
  // );
  // 1. Create Account
  const createAccTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  await sendAndConfirmTransaction(
    connection,
    createAccTx,
    [payer, mintKeypair],
    undefined
  );

  // 2. Initialize Hook
  await initializeTransferHook(
    connection,
    payer,
    mintKeypair.publicKey,
    mintAuthority.publicKey,
    transferHookProgramId,
    {
      skipPreflight: true,
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    },
    TOKEN_2022_PROGRAM_ID
  );

  // 3. Initialize Mint
  const initMintTx = new Transaction().add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      9,
      mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(
    connection,
    initMintTx,
    [payer, mintKeypair],
    undefined
  );

  // console.log(`Mint signature: ${mint_signature}`);
  return mintKeypair.publicKey;
}

// create a token mint and a token2022 mint with transferFeeConfig
export async function createTokenMintAndAssociatedTokenAccount(
  connection: Connection,
  payer: Signer,
  mintAuthority: Signer,
  // transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number }
  transferHookProgramId: PublicKey
) {
  let ixs: TransactionInstruction[] = [];
  ixs.push(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: mintAuthority.publicKey,
      lamports: web3.LAMPORTS_PER_SOL,
    })
  );
  await sendTransaction(connection, ixs, [payer]);

  interface Token {
    address: PublicKey;
    program: PublicKey;
  }

  let tokenArray: Token[] = [];
  let token0 = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    9,
    undefined,
    {
      commitment: "confirmed",
    }
  );
  tokenArray.push({ address: token0, program: TOKEN_PROGRAM_ID });

  let token1 = await createMintWithTransferHook(
    connection,
    payer,
    mintAuthority,
    Keypair.generate(),
    transferHookProgramId
  );
  console.log(`Token 1: ${token1}`);

  tokenArray.push({ address: token1, program: TOKEN_2022_PROGRAM_ID });

  tokenArray.sort(function (x, y) {
    const buffer1 = x.address.toBuffer();
    const buffer2 = y.address.toBuffer();

    for (let i = 0; i < buffer1.length && i < buffer2.length; i++) {
      if (buffer1[i] < buffer2[i]) {
        return -1;
      }
      if (buffer1[i] > buffer2[i]) {
        return 1;
      }
    }

    if (buffer1.length < buffer2.length) {
      return -1;
    }
    if (buffer1.length > buffer2.length) {
      return 1;
    }

    return 0;
  });

  token0 = tokenArray[0].address;
  token1 = tokenArray[1].address;
  //   console.log("Token 0", token0.toString());
  //   console.log("Token 1", token1.toString());
  const token0Program = tokenArray[0].program;
  const token1Program = tokenArray[1].program;

  console.log(`Token 1: ${token1}`);
  sleep(4000);
  const ata1 = await createATAWithTransferHook(
    connection,
    payer,
    token1,
    payer.publicKey,
    token1Program
  );
  console.log(`ata1: ${ata1.address}`);
  const ata0 = await createATAWithTransferHook(
    connection,
    payer,
    token0,
    payer.publicKey,
    token0Program
  );
  console.log(`ata0: ${ata0.address}`);
  // await sleep(100000);
  // sleep(10000);
  // console.log("hmmm");
  // console.log(`Testing Token0 ${token0}`);
  // console.log(token0Program);
  // console.log(token1Program);
  const ownerToken0Account = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    token0,
    payer.publicKey,
    false,
    "processed",
    { skipPreflight: true },
    token0Program
  ).catch((err) => {
    console.log("owner token 0");
    console.log(err);
  });
  // console.log(`Owner Token 0 ${ownerToken0Account.address}`);
  // console.log(`Owner 0: ${ownerToken0Account.address}`);
  // console.log("works before here");
  await mintTo(
    connection,
    payer,
    token0,
    ownerToken0Account.address,
    mintAuthority,
    100_000_000_000_000,
    [],
    { skipPreflight: true },
    token0Program
  );
  // .catch((err) => {
  //   console.log("mint entry");
  //   console.log(err);
  // });
  // console.log("checking mint");
  // // console.log(
  // //   "ownerToken0Account key: ",
  // //   ownerToken0Account.address.toString()
  // // );
  // console.log(`TEsting token1 ${token1}`);
  // sleep(20000);
  const ownerToken1Account = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    token1,
    payer.publicKey,
    false,
    "processed",
    { skipPreflight: false },
    token1Program
  ).catch((err) => {
    console.log("owner token 1");
    console.log(err);
  });
  // console.log(`Owner 1: ${ownerToken1Account.address}`);
  // console.log("works after here");
  // // console.log(
  // //   "ownerToken1Account key: ",
  // //   ownerToken1Account.address.toString()
  // sleep(10000);
  await mintTo(
    connection,
    payer,
    token1,
    ownerToken1Account.address,
    mintAuthority,
    100_000_000_000_000,
    [],
    { skipPreflight: true },
    token1Program
  );

  return [
    { token0, token0Program },
    { token1, token1Program },
  ];
}

export async function setupInitializeTest2(
  program: Program<RaydiumCpSwap>,
  connection: Connection,
  owner: Signer,
  config: {
    config_index: number;
    tradeFeeRate: BN;
    protocolFeeRate: BN;
    fundFeeRate: BN;
    // );
    create_fee: BN;
  },
  // transferFeeConfig: { transferFeeBasisPoints: number; MaxFee: number } = {
  //   transferFeeBasisPoints: 0,
  //   MaxFee: 0,
  // },
  transferHookProgramId: PublicKey,
  confirmOptions?: ConfirmOptions
) {
  const [{ token0, token0Program }, { token1, token1Program }] =
    await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      // transferFeeConfig
      transferHookProgramId
    );
  console.log("finally passed the assc issue");
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

//
async function createATAWithTransferHook(
  connection,
  payer,
  mint,
  owner,
  tokenProgram = TOKEN_2022_PROGRAM_ID
) {
  try {
    // Get the associated token address
    const associatedTokenAddress = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      tokenProgram
    );

    // Check if account already exists
    try {
      const account = await getAccount(
        connection,
        associatedTokenAddress,
        "confirmed",
        tokenProgram
      );
      console.log(`ATA already exists: ${associatedTokenAddress}`);
      return { address: associatedTokenAddress };
    } catch (error) {
      // Account doesn't exist, we need to create it
    }

    // Create the instruction for ATA creation
    const instruction = createAssociatedTokenAccountInstruction(
      payer.publicKey, // payer
      associatedTokenAddress, // ata
      owner, // owner
      mint, // mint
      tokenProgram // token program
    );

    // Create and send transaction
    const transaction = new Transaction().add(instruction);

    // Set recent blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // Send transaction with proper commitment
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
      commitment: "confirmed",
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`ATA created with signature: ${signature}`);
    console.log(`ATA address: ${associatedTokenAddress}`);

    return { address: associatedTokenAddress };
  } catch (error) {
    console.error("Error creating ATA with transfer hook:", error);
    throw error;
  }
}
