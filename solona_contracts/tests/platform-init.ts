// import * as anchor from "@project-serum/anchor";
// import { Program } from "@project-serum/anchor";
// import { TaleForge } from "../target/types/tale_forge";
// import { 
//     PublicKey, 
//     SystemProgram, 
//     SYSVAR_RENT_PUBKEY,
//     Keypair 
// } from '@solana/web3.js';
// import { 
//     TOKEN_PROGRAM_ID, 
//     createMint,
//     getAccount,
//     createAssociatedTokenAccount,
//     createInitializeAccountInstruction
// } from "@solana/spl-token";
// import { assert } from "chai";

// describe("Platform Initialization", () => {
//     // 配置 provider
//     const provider = anchor.AnchorProvider.env();
//     anchor.setProvider(provider);

//     // 打印连接信息
//     console.log("RPC URL:", provider.connection.rpcEndpoint);
//     console.log("Commitment:", provider.connection.commitment);

//     // 加载程序
//     const program = anchor.workspace.TaleForge as Program<TaleForge>;

//     // 测试账户
//     let platformAuthority: Keypair;//平台权限账户
//     let mint: PublicKey;            //代币铸币权
//     let miningPool: PublicKey;      //挖矿池（PDA）
//     let readerRewardPool: PublicKey;//读者奖励池（PDA）
//     let miningPoolToken: PublicKey;//挖矿池代币账户

//     before(async () => {
//         // 创建平台权限账户
//         platformAuthority = Keypair.generate();
        
//         // 多次空投以确保足够的 SOL
//         for (let i = 0; i < 3; i++) {
//             try {
//                 const airdropSignature = await provider.connection.requestAirdrop(
//                     platformAuthority.publicKey,
//                     10 * anchor.web3.LAMPORTS_PER_SOL
//                 );
                
//                 // 等待确认，使用更严格的确认级别
//                 await provider.connection.confirmTransaction({
//                     signature: airdropSignature,
//                     lastValidBlockHeight: await provider.connection.getBlockHeight(),
//                     blockhash: (await provider.connection.getLatestBlockhash()).blockhash
//                 });

//                 // 验证余额
//                 const balance = await provider.connection.getBalance(platformAuthority.publicKey);
//                 console.log(`Attempt ${i + 1} - platformAuthority Balance:`, balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
                
//                 if (balance > 0) {
//                     console.log("Airdrop successful!");
//                     break;
//                 }
//             } catch (error) {
//                 console.error(`Attempt ${i + 1} failed:`, error);
//                 if (i === 2) throw error; // 如果最后一次尝试也失败，则抛出错误
//             }
            
//             // 在尝试之间等待一小段时间
//             await new Promise(resolve => setTimeout(resolve, 1000));
//         }

//         // 生成 PDA
//         [miningPool] = PublicKey.findProgramAddressSync(
//             [Buffer.from("mining_pool")],
//             program.programId
//         );

//         [readerRewardPool] = PublicKey.findProgramAddressSync(
//             [Buffer.from("reader_reward_pool")],
//             program.programId
//         );
//     });

//     it("should initialize platform successfully", async () => {
//         try {
//             // 创建代币铸币权
//             mint = await createMint(
//                 provider.connection,
//                 platformAuthority,
//                 platformAuthority.publicKey,
//                 null,
//                 9
//             );
//             console.log("Mint created:", mint.toString());

//             // 生成 PDA 和 bump
//             const [miningPoolPDA, miningPoolBump] = await PublicKey.findProgramAddressSync(
//                 [Buffer.from("mining_pool")],
//                 program.programId
//             );
//             miningPool = miningPoolPDA;

//             const [readerRewardPoolPDA, readerRewardPoolBump] = await PublicKey.findProgramAddressSync(
//                 [Buffer.from("reader_reward_pool")],
//                 program.programId
//             );
//             readerRewardPool = readerRewardPoolPDA;

//             // 为挖矿池创建代币账户
//             const miningPoolTokenKP = Keypair.generate();
//             miningPoolToken = miningPoolTokenKP.publicKey;

//             // 创建代币账户的交易
//             const createAccountTx = await provider.connection.sendTransaction(
//                 new anchor.web3.Transaction().add(
//                     SystemProgram.createAccount({
//                         fromPubkey: platformAuthority.publicKey,
//                         newAccountPubkey: miningPoolTokenKP.publicKey,
//                         space: 165,
//                         lamports: await provider.connection.getMinimumBalanceForRentExemption(165),
//                         programId: TOKEN_PROGRAM_ID,
//                     })
//                 ),
//                 [platformAuthority, miningPoolTokenKP]
//             );
//             await provider.connection.confirmTransaction(createAccountTx);

//             // 初始化代币账户的交易
//             const initAccountTx = await provider.connection.sendTransaction(
//                 new anchor.web3.Transaction().add(
//                     createInitializeAccountInstruction(
//                         miningPoolTokenKP.publicKey,
//                         mint,
//                         miningPool
//                     )
//                 ),
//                 [platformAuthority]
//             );
//             await provider.connection.confirmTransaction(initAccountTx);

//             // 查看余额
//             const balance = await provider.connection.getBalance(platformAuthority.publicKey);
//             console.log(` 平台账户platformAuthority Balance:`, balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
           
//             // 执行平台初始化
//             const tx = await program.methods.initializePlatform()
//                 .accounts({
//                     miningPool,
//                     readerRewardPool,
//                     mint,
//                     miningPoolToken: miningPoolTokenKP.publicKey,
//                     authority: platformAuthority.publicKey,
//                     systemProgram: SystemProgram.programId,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     rent: SYSVAR_RENT_PUBKEY,
//                 })
//                 // 不需要为 PDA 提供签名，因为它们是程序派生的地址
//                 .signers([platformAuthority])
//                 // 添加 remainingAccounts 来包含 PDA
//                 .remainingAccounts([
//                     { pubkey: miningPool, isWritable: true, isSigner: false },
//                     { pubkey: readerRewardPool, isWritable: true, isSigner: false }
//                 ])
//                 .rpc()
//                 .catch(error => {
//                     // 打印出所有涉及的账户的公钥
//                     console.log("miningPool:", miningPool.toString());
//                     console.log("readerRewardPool:", readerRewardPool.toString());
//                     console.log("mint:", mint.toString());
//                     console.log("miningPoolToken:", miningPoolTokenKP.publicKey.toString());
//                     console.log("authority:", platformAuthority.publicKey.toString());
//                     throw error;
//                 });

//             console.log("Transaction signature:", tx);

//             // 验证挖矿池状态
//             const miningPoolAccount = await program.account.miningPool.fetch(miningPool);
//             assert.equal(miningPoolAccount.totalAmount.toString(), "1000000000");
//             assert.equal(miningPoolAccount.totalDistributed.toString(), "0");
//             assert.equal(miningPoolAccount.tokenMint.toString(), mint.toString());
//             assert(miningPoolAccount.startTime.gt(new anchor.BN(0)));

//             // 验证代币账户状态
//             const tokenAccount = await getAccount(provider.connection, miningPoolToken);
//             assert.equal(tokenAccount.amount.toString(), "1000000000");
//             assert.equal(tokenAccount.mint.toString(), mint.toString());

//             console.log("Platform initialized successfully!");
//         } catch (error) {
//             console.error("Detailed error:", error);
//             if (error.logs) {
//                 console.error("Transaction logs:", error.logs);
//             }
//             throw error;
//         }
//     });
// }); 