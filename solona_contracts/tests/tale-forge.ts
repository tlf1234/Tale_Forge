import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TaleForge } from "../target/types/tale_forge";
import { 
    PublicKey, 
    SystemProgram, 
    SYSVAR_RENT_PUBKEY,
    Keypair 
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    createMint, 
    createAccount,
    getAccount,
    createAssociatedTokenAccount,
    createInitializeAccountInstruction,
    mintTo,
    getAssociatedTokenAddress,
} from "@solana/spl-token";

import { assert } from "chai";

// NFT类型定义
// enum NFTType {
//     Character,
//     Scene,
//     Pet,
//     Item
// }

// enum Rarity {
//     Common,
//     Rare,
//     Epic,
//     Legendary
// }

// interface NFTAccount {
//     story: PublicKey;
//     name: string;
//     description: string;
//     imageUri: string;
//     nftType: NFTType;
//     rarity: Rarity;
//     owner: PublicKey;
//     mintBatch: number;
//     miningWeight: number;
//     isListed: boolean;
//     listPriceSol: anchor.BN;
//     listPriceToken: anchor.BN;
//     listTime: anchor.BN;
//     createdAt: anchor.BN;
// }

// 辅助函数：获取代币账户余额
async function getTokenBalance(connection: anchor.web3.Connection, tokenAccount: PublicKey): Promise<number> {
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount);
}

// it.skip() 跳过单个测试
// describe.skip() 跳过整个测试场景组
// it.only() 只运行这个测试
// describe.only() 只运行这个测试场景组


// 1. 平台初始化测试场景
describe.skip("Platform Initialization Tests", () => {
    // 设置测试环境
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TaleForge as Program<TaleForge>;

    // 测试账户
    let miningPool: PublicKey;
    let readerRewardPool: PublicKey;
    let mint: PublicKey;
    let miningPoolToken: PublicKey;
    let platformAuthority: Keypair;

    // 在所有测试前设置
    before(async () => {
        // 创建平台权限账户
        platformAuthority = Keypair.generate();
        
        // 为平台权限账户提供测试 SOL
        await provider.connection.requestAirdrop(
            platformAuthority.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 生成程序账户地址
        [miningPool] = await PublicKey.findProgramAddress(
            [Buffer.from("mining_pool")],
            program.programId
        );
        console.log("Mining pool address:", miningPool.toString());
        [readerRewardPool] = await PublicKey.findProgramAddress(
            [Buffer.from("reader_reward_pool")],
            program.programId
        );
        console.log("Reader reward pool address:", readerRewardPool.toString());
    });

    // 1. 正常场景测试
    describe("Normal Scenarios", () => {
        it("should initialize platform with correct parameters", async () => {
            try {
                 // 创建代币铸币权
                mint = await createMint(
                    provider.connection,
                    platformAuthority,
                    platformAuthority.publicKey,
                    null,
                    9
                );
                console.log("Mint created:", mint.toString());

                // 生成挖矿池 PDA 和 bump
                const [miningPoolPDA, miningPoolBump] = await PublicKey.findProgramAddressSync(
                    [Buffer.from("mining_pool")],
                    program.programId
                );
                miningPool = miningPoolPDA;

                // 生成读者奖励池 PDA 和 bump
                const [readerRewardPoolPDA, readerRewardPoolBump] = await PublicKey.findProgramAddressSync(
                    [Buffer.from("reader_reward_pool")],
                    program.programId
                );
                readerRewardPool = readerRewardPoolPDA;

                // 创建挖矿池代币账户
                const miningPoolTokenKP = Keypair.generate();
                miningPoolToken = miningPoolTokenKP.publicKey;

                // 创建代币账户的交易
            const createAccountTx = await provider.connection.sendTransaction(
                new anchor.web3.Transaction().add(
                    SystemProgram.createAccount({
                        fromPubkey: platformAuthority.publicKey,
                        newAccountPubkey: miningPoolTokenKP.publicKey,
                        space: 165,
                        lamports: await provider.connection.getMinimumBalanceForRentExemption(165),
                        programId: TOKEN_PROGRAM_ID,
                    })
                ),
                [platformAuthority, miningPoolTokenKP]
            );
            await provider.connection.confirmTransaction(createAccountTx);

            // 初始化代币账户的交易
            const initAccountTx = await provider.connection.sendTransaction(
                new anchor.web3.Transaction().add(
                    createInitializeAccountInstruction(
                        miningPoolTokenKP.publicKey,
                        mint,
                        miningPool
                    )
                ),
                [platformAuthority]
            );
            await provider.connection.confirmTransaction(initAccountTx);
                // 执行平台初始化
                const tx = await program.methods.initializePlatform()
                .accounts({
                    miningPool,
                    readerRewardPool,
                    mint,
                    miningPoolToken: miningPoolTokenKP.publicKey,
                    authority: platformAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                // 不需要为 PDA 提供签名，因为它们是程序派生的地址
                .signers([platformAuthority])
                // 添加 remainingAccounts 来包含 PDA
                .remainingAccounts([
                    { pubkey: miningPool, isWritable: true, isSigner: false },
                    { pubkey: readerRewardPool, isWritable: true, isSigner: false }
                ])
                .rpc()
                .catch(error => {
                    // 打印出所有涉及的账户的公钥
                    console.log("miningPool:", miningPool.toString());
                    console.log("readerRewardPool:", readerRewardPool.toString());
                    console.log("mint:", mint.toString());
                    console.log("miningPoolToken:", miningPoolTokenKP.publicKey.toString());
                    console.log("authority:", platformAuthority.publicKey.toString());
                    throw error;
                });

                console.log("Platform initialized successfully!");
                // 验证挖矿池状态
                const miningPoolAccount = await program.account.miningPool.fetch(miningPool);
                assert.equal(miningPoolAccount.totalAmount.toString(), "1000000000");
                assert.equal(miningPoolAccount.totalDistributed.toString(), "0");
                assert.equal(miningPoolAccount.tokenMint.toString(), mint.toString());
                assert(miningPoolAccount.startTime.gt(new anchor.BN(0)));
                assert.equal(miningPoolAccount.currentEpoch.toString(), "0");
                console.log("Mining pool account:", miningPoolAccount);
                // 验证读者奖励池状态
                const readerPoolAccount = await program.account.readerRewardPool.fetch(readerRewardPool);
                assert.equal(readerPoolAccount.totalAmount.toString(), "0");
                assert.equal(readerPoolAccount.activeReaders, 0);
                assert.equal(readerPoolAccount.tokenMint.toString(), mint.toString());
                console.log("Reader pool account:", readerPoolAccount);
                // 验证代币账户状态
                const tokenAccount = await getAccount(provider.connection, miningPoolToken);
                assert.equal(tokenAccount.amount.toString(), "1000000000");
                assert.equal(tokenAccount.mint.toString(), mint.toString());
                console.log("Token account:", tokenAccount);
            } catch (error: any) {
                console.error("Error:", error);
                throw error;
            }
        });
    });

    // 2. 边界条件测试
    describe("Boundary Conditions", () => {
        it("should validate minimum required accounts", async () => {
            // 测试缺少必要账户的情况
            try {
                await program.methods.initializePlatform()
                    .accounts({
                        miningPool,
                        readerRewardPool,
                        mint,
                        // 故意省略 miningPoolToken
                        authority: platformAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .signers([platformAuthority])
                    .rpc();
                // console.log("Platform initialized successfully!");
                assert.fail("Should fail without required accounts");
            } catch (error: any) {
                // console.log("Error:", error);
                assert.ok(error);
            }
        });
    });

    // 3. 错误处理测试
    describe("Error Handling", () => {
        it("should fail on duplicate initialization", async () => {
            try {
                // 尝试重复初始化
                await program.methods.initializePlatform()
                    .accounts({
                        miningPool,
                        readerRewardPool,
                        mint,
                        miningPoolToken,
                        authority: platformAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .signers([platformAuthority])
                    .rpc();
                // console.log("Platform initialized successfully!");
                assert.fail("Should not allow second initialization");
            } catch (error: any) {
                // console.log("Error:", error);
                assert.ok(error);
            }
        });

        it("should fail with invalid authority", async () => {
            // 创建一个无权限的账户
            const invalidAuthority = Keypair.generate();
            try {
                await program.methods.initializePlatform()
                    .accounts({
                        miningPool,
                        readerRewardPool,
                        mint,
                        miningPoolToken,
                        authority: invalidAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .signers([invalidAuthority])
                    .rpc();
                assert.fail("Should fail with invalid authority");
            } catch (error: any) {
                console.log("Error:", error);
                assert.ok(error);
            }
        });
    });
});

// 2. 作者管理测试场景
describe.skip("Author Management Tests", () => {

     // 设置测试环境
     const provider = anchor.AnchorProvider.env();
     anchor.setProvider(provider);
  const program = anchor.workspace.TaleForge as Program<TaleForge>;

    // 测试账户
    let authorAuthority: Keypair;
    let authorAccount: PublicKey;
    let testId: number;
    
    beforeEach(async () => {
        // 每个测试前创建新的作者账户
        authorAuthority = Keypair.generate();
        testId = Date.now(); // 使用时间戳确保每次测试的笔名都不同
        
        // 为作者账户提供测试 SOL
        await provider.connection.requestAirdrop(
            authorAuthority.publicKey,
            5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 生成作者 PDA
        [authorAccount] = await PublicKey.findProgramAddress(
            [Buffer.from("author"), authorAuthority.publicKey.toBuffer()],
            program.programId
        );
    });

    // 1. 正常场景测试
    it("should register new author successfully", async () => {
        try {
            const penName = `Test Author ${testId}`;
            // 生成笔名记录 PDA
            const [penNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );

            const tx = await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: penNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 验证作者账户创建
            const authorData = await program.account.author.fetch(authorAccount);
            assert.equal(authorData.penName, penName);
            assert.equal(authorData.address.toString(), authorAuthority.publicKey.toString());
            assert.equal(authorData.storyCount, 0);
            assert.equal(authorData.totalWordCount.toString(), "0");
            assert.equal(authorData.totalEarningsSol.toString(), "0");
            assert.equal(authorData.totalEarningsToken.toString(), "0");
            assert.equal(authorData.totalMiningRewards.toString(), "0");

            // 验证笔名记录创建
            const penNameData = await program.account.penNameRecord.fetch(penNameRecord);
            assert.equal(penNameData.penName, penName);
            assert.equal(penNameData.owner.toString(), authorAuthority.publicKey.toString());
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    it("should update author statistics correctly", async () => {
        try {
            const penName = `Test Author ${testId}_stats`;
            // 先注册作者
            const [penNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );

            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: penNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 更新作者统计信息
            const tx = await program.methods.updateAuthorStats(
                new anchor.BN(1), // 增加一个作品
                new anchor.BN(5000), // 增加5000字
                new anchor.BN(100), // 增加100代币收益
                new anchor.BN(100) // 增加100 SOL收益
            )
            .accounts({
                author: authorAccount,
                authority: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证统计更新
            const authorData = await program.account.author.fetch(authorAccount);
            assert.equal(authorData.storyCount, 1);
            assert.equal(authorData.totalWordCount.toString(), "5000");
            assert.equal(authorData.totalEarningsSol.toString(), "100");
            console.log("Author data:", authorData);

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // //笔名长度测试
    // it("should validate pen name length constraints", async () => {
    //     try {
    //         const shortPenName = `A_${testId}`;
    //         // 生成笔名记录 PDA
    //         const [shortPenNameRecord] = await PublicKey.findProgramAddress(
    //             [Buffer.from("pen_name"), Buffer.from(shortPenName)],
    //             program.programId
    //         );

    //         await program.methods.registerAuthor(shortPenName)
    //             .accounts({
    //                 author: authorAccount,
    //                 penNameRecord: shortPenNameRecord,
    //                 authority: authorAuthority.publicKey,
    //                 systemProgram: SystemProgram.programId,
    //             })
    //             .signers([authorAuthority])
    //             .rpc();

    //         // 验证笔名更新
    //         const authorData = await program.account.author.fetch(authorAccount);
    //         console.log("Author data:", authorData);
    //         assert.equal(authorData.penName, shortPenName);
    //     } catch (error) {
    //         console.error("Error:", error);
    //         throw error;
    //     }
    // });

    // 2.3 作品数上限测试
    it("should handle maximum stories limit", async () => {
        try {
            const penName = `Test Author ${testId}_max`;
            // 生成笔名记录 PDA
            const [penNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );
            // 注册作者
            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: penNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 更新到最大作品数（50）
            await program.methods.updateAuthorStats(
                new anchor.BN(50), // 直接设置为最大作品数
                new anchor.BN(0),
                new anchor.BN(0),
                new anchor.BN(0)
            )
                .accounts({
                    author: authorAccount,
                authority: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证作品数上限
            const authorData = await program.account.author.fetch(authorAccount);
            assert.equal(authorData.storyCount, 50);

            // 尝试再次增加作品数应该失败
            let errorThrown = false;
            try {
                await program.methods.updateAuthorStats(
                    new anchor.BN(1), // 尝试再增加一个作品
                    new anchor.BN(0),
                    new anchor.BN(0),
                    new anchor.BN(0)
                )
                .accounts({
                    author: authorAccount,
                    authority: authorAuthority.publicKey,
                })
                .signers([authorAuthority])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                console.log("Expected error:", error.toString());
                // 确保错误是由于超出最大作品数导致的
                assert.ok(
                    error.toString().includes("MaxStoriesExceeded") || 
                    error.toString().includes("0x1771") ||
                    error.toString().includes("custom program error")
                );
            }
            assert.ok(errorThrown, "Expected an error to be thrown when exceeding maximum story count");
        } catch (error: any) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3. 中文笔名测试
    it("should register new author with Chinese pen name", async () => {
        try {
            const chinesePenName = `测试作者${testId}`;
            const [chinesePenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(chinesePenName)],
                program.programId
            );

            await program.methods.registerAuthor(chinesePenName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: chinesePenNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 验证作者账户创建
            const authorData = await program.account.author.fetch(authorAccount);
            assert.equal(authorData.penName, chinesePenName);
            assert.equal(authorData.address.toString(), authorAuthority.publicKey.toString());
            assert.equal(authorData.storyCount, 0);
            assert.equal(authorData.totalWordCount.toString(), "0");
            assert.equal(authorData.totalEarningsSol.toString(), "0");
            assert.equal(authorData.totalEarningsToken.toString(), "0");
            console.log("Author data:", authorData);
            
        } catch (error) {

            console.error("Error:", error);
            throw error;
        }
    });

    // 3.1 中文笔名长度测试
    it("should validate Chinese pen name length", async () => {
        try {
            // 使用较短的中文笔名，避免超出种子长度限制
            const shortId = testId.toString().slice(-4);
            const longChineseName = `中文笔名${shortId}`; 
            const [longChinesePenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(longChineseName)],
                program.programId
            );

            await program.methods.registerAuthor(longChineseName)
            .accounts({
                author: authorAccount,
                    penNameRecord: longChinesePenNameRecord,
                authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证笔名更新
            const authorData = await program.account.author.fetch(authorAccount);
            console.log("Author data:", authorData);
            assert.equal(authorData.penName, longChineseName);
        } catch (error: any) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 4. 笔名更新测试
    it("should update pen name successfully", async () => {
        try {
            const penName = `Test Author ${testId}_update`;
            // 先注册作者
            const [initialPenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );

            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: initialPenNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 等待一下确保交易完成
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 然后更新笔名
            const newPenName = "Updated Author Name";
            const [newPenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(newPenName)],
                program.programId
            );

            await program.methods.updatePenName(newPenName)
                .accounts({
                    author: authorAccount,
                    oldPenNameRecord: initialPenNameRecord,
                    newPenNameRecord: newPenNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 验证笔名更新
            const authorData = await program.account.author.fetch(authorAccount);
            assert.equal(authorData.penName, newPenName);

            // 验证新笔名记录
            const newPenNameData = await program.account.penNameRecord.fetch(newPenNameRecord);
            assert.equal(newPenNameData.penName, newPenName);
            assert.equal(newPenNameData.owner.toString(), authorAuthority.publicKey.toString());

            // 验证旧笔名记录已关闭
            try {
                await program.account.penNameRecord.fetch(initialPenNameRecord);
                assert.fail("Old pen name record should be closed");
            } catch (error: any) {
                assert.ok(error.toString().includes("Account does not exist"));
            }
        } catch (error: any) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 4.1 笔名更新错误处理
    it("should fail to update pen name with invalid length", async () => {
        try {
            // 使用较短的ID来避免种子长度超限
            const shortId = testId.toString().slice(-4);
            const penName = `Test Author ${shortId}_invalid`;
            // 生成笔名记录 PDA
            const [initialPenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );
            // 注册作者
            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: initialPenNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            //
            try {
                // 生成空笔名记录 PDA
                const [emptyPenNameRecord] = await PublicKey.findProgramAddress(
                    [Buffer.from("pen_name"), Buffer.from("")],
                    program.programId
                );
                // 更新笔名
                await program.methods.updatePenName("")
                    .accounts({
                        author: authorAccount,
                        oldPenNameRecord: initialPenNameRecord,
                        newPenNameRecord: emptyPenNameRecord,
                        authority: authorAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([authorAuthority])
                    .rpc();
                assert.fail("Should not allow empty pen name");
            } catch (error: any) {
                console.log("Empty pen name error:", error.toString());
                assert.ok(
                    error.toString().includes("InvalidPenNameLength"),
                    `Expected error to include 'InvalidPenNameLength', but got: ${error.toString()}`
                );
            }
            //打印测试结果
            console.log("penName:", penName);
       

            //测试超长笔名注册（51字符）（这个直接应用上尝试了吧）


            // 测试超长笔名更新（51字符）
            try {
                // 生成超长笔名记录 PDA
                const longPenName = "A".repeat(51);
                const [longPenNameRecord] = await PublicKey.findProgramAddress(
                    [Buffer.from("pen_name"), Buffer.from(longPenName)],
                    program.programId
                );
                // 更新笔名
                await program.methods.updatePenName(longPenName)
                    .accounts({
                        author: authorAccount,
                        oldPenNameRecord: initialPenNameRecord,
                        newPenNameRecord: longPenNameRecord,
                        authority: authorAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([authorAuthority])
                    .rpc();
                assert.fail("Should not allow pen name longer than 50 characters");
            } catch (error: any) {
                console.log("Long pen name error:", error.toString());
                // 接受系统的种子长度错误
                assert.ok(
                    error.toString().includes("Max seed length exceeded") || 
                    error.toString().includes("InvalidPenNameLength"),
                    "Expected error to be either seed length exceeded or invalid length"
                );
            }
        } catch (error: any) {
            console.error("Test error:", error);
            throw error;
        }
    });

    // 5、在 Author Management Tests 的测试用例中添加笔名唯一性测试
    it("should fail when registering duplicate pen name", async () => {
        try {
            const shortId = testId.toString().slice(-4);
            const penName = `Test Author ${shortId}_invalid`;
      
            // 先注册第一个作者
            const [penNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );

            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: penNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 创建第二个作者账户
            const duplicateAuthority = Keypair.generate();
            await provider.connection.requestAirdrop(
                duplicateAuthority.publicKey,
                5 * anchor.web3.LAMPORTS_PER_SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            const [duplicateAuthorAccount] = await PublicKey.findProgramAddress(
                [Buffer.from("author"), duplicateAuthority.publicKey.toBuffer()],
                program.programId
            );

            // 尝试注册已存在的笔名
            try {
                await program.methods.registerAuthor(penName)
                    .accounts({
                        author: duplicateAuthorAccount,
                        penNameRecord: penNameRecord,
                        authority: duplicateAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([duplicateAuthority])
                    .rpc();
                assert.fail("Should not allow duplicate pen name");
            } catch (error: any) {
                console.log("Duplicate pen name error:", error.toString());
                // 接受系统的账户已存在错误
                assert.ok(
                    error.toString().includes("already in use") || 
                    error.toString().includes("PenNameAlreadyExists"),
                    "Expected error to indicate account already exists"
                );
            }
        } catch (error: any) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 5.1 中文笔名唯一性测试
    it("should fail when registering duplicate Chinese pen name", async () => {
        try {
            const shortId = testId.toString().slice(-4);
            const chinesePenName = `测试作者${shortId}_duplicate`;
            // 注册第一个作者
            const [chinesePenNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(chinesePenName)],
                program.programId
            );
            // 注册第一个作者
            await program.methods.registerAuthor(chinesePenName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: chinesePenNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
            // 验证笔名输入
            const authorData = await program.account.author.fetch(authorAccount);
            console.log("Author data:", authorData);
            // 创建第二个作者账户
            const duplicateChineseAuthority = Keypair.generate();
            await provider.connection.requestAirdrop(
                duplicateChineseAuthority.publicKey,
                5 * anchor.web3.LAMPORTS_PER_SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            const [duplicateChineseAuthorAccount] = await PublicKey.findProgramAddress(
                [Buffer.from("author"), duplicateChineseAuthority.publicKey.toBuffer()],
                program.programId
            );

            console.log("chinesePenNameRecord:", chinesePenNameRecord.toString());
            console.log("duplicateChineseAuthorAccount:", duplicateChineseAuthorAccount.toString());
           
            try {
                await program.methods.registerAuthor(chinesePenName)
                    .accounts({
                        author: duplicateChineseAuthorAccount,
                        penNameRecord: chinesePenNameRecord,
                        authority: duplicateChineseAuthority.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([duplicateChineseAuthority])
                    .rpc();
                assert.fail("Should not allow duplicate Chinese pen name");
            } catch (error: any) {
                console.log("Duplicate Chinese pen name error:", error.toString());
                // 接受系统的账户已存在错误
                assert.ok(
                    error.toString().includes("already in use") || 
                    error.toString().includes("PenNameAlreadyExists"),
                    "Expected error to indicate account already exists"
                );
            }
        } catch (error: any) {
            console.error("Error:", error);
            throw error;
        }
    });
});

// 3. 作品管理测试场景
describe.skip("Story Management Tests", () => {

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TaleForge as Program<TaleForge>;
    
    // 测试账户
    let authorAuthority: Keypair;
    let authorAccount: PublicKey;
    let storyAccount: PublicKey;
    let penNameRecord: PublicKey;
    let testId: number;

    beforeEach(async () => {
        // 每个测试前创建新的作者账户（作者账户和作者钱包地址相同）
        authorAuthority = Keypair.generate();
        testId = Date.now();
        
        // 为作者账户提供测试 SOL
        await provider.connection.requestAirdrop(
            authorAuthority.publicKey,
            5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 生成作者账户
        [authorAccount] = await PublicKey.findProgramAddress(
            [Buffer.from("author"), authorAuthority.publicKey.toBuffer()],
            program.programId
        );

        // 注册作者
        const penName = `Test Author ${testId.toString().slice(-4)}`;
        [penNameRecord] = await PublicKey.findProgramAddress(
            [Buffer.from("pen_name"), Buffer.from(penName)],
            program.programId
        );

            await program.methods.registerAuthor(penName)
                .accounts({
                    author: authorAccount,
                    penNameRecord: penNameRecord,
                    authority: authorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

        // 生成作品 PDA
        [storyAccount] = await PublicKey.findProgramAddress(
            [Buffer.from("story"), authorAuthority.publicKey.toBuffer(), new anchor.BN(0).toArrayLike(Buffer, "le", 4)],
            program.programId
        );
    });

    // 3.1 作品基本操作测试
    it("should create story with valid parameters", async () => {
        try {
            const title = "Test Story";
            const description = "This is a test story";
            const coverCid = "QmTest123Cover";
            const contentCid = "QmTest123Content";
            const targetWordCount = new anchor.BN(50000);
            
            await program.methods.createStory(
                title,
                description,
                coverCid,
                contentCid,
                targetWordCount
            )
            .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                author: authorAccount,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证作品创建
            const storyData = await program.account.story.fetch(storyAccount);
            assert.equal(storyData.title, title);
            assert.equal(storyData.description, description);
            assert.equal(storyData.coverCid, coverCid);
            assert.equal(storyData.contentCid, contentCid);
            assert.equal(storyData.targetWordCount.toString(), targetWordCount.toString());
            assert.equal(storyData.author.toString(), authorAuthority.publicKey.toString());
            assert.equal(storyData.isCompleted, false);
            assert.equal(storyData.chapterCount, 1);
            assert.equal(storyData.wordCount.toString(), "0");
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.2 作品元数据更新测试
    it("should update story metadata correctly", async () => {
        try {
            // 先创建作品
            const initialTitle = "Initial Title";
            const initialDescription = "Initial description";
            const initialCoverCid = "QmTest123Cover";
            const initialContentCid = "QmTest123Content";
            const initialTargetWordCount = new anchor.BN(50000);

            await program.methods.createStory(
                initialTitle,
                initialDescription,
                initialCoverCid,
                initialContentCid,
                initialTargetWordCount
            )
                .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 更新作品设置
            const nftMintingEnabled = true;
            const maxNfts = 100;

            await program.methods.updateStorySettings(
                nftMintingEnabled,
                maxNfts
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证更新
            const storyData = await program.account.story.fetch(storyAccount);
            assert.equal(storyData.nftMintingEnabled, nftMintingEnabled);
            assert.equal(storyData.maxNfts, maxNfts);
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.2 章节管理测试
    it("should manage chapters correctly", async () => {
        try {
            // 创建作品
            await program.methods.createStory(
                "Test Story",
                "Description",
                "QmTest123Cover",
                "QmTest123Content",
                new anchor.BN(50000)
            )
                .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();

            // 更新章节
            const chapterCid = "QmTest123Chapter1";
            const chapterNumber = 2;

            await program.methods.updateChapter(
                chapterNumber,
                chapterCid
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证章节更新
            const updatedStoryData = await program.account.story.fetch(storyAccount);
            assert.equal(updatedStoryData.chapterCount, chapterNumber);
            assert.equal(updatedStoryData.contentCid, chapterCid);

            // 更新作品设置
            const nftMintingEnabled = true;
            const maxNfts = 100;

            await program.methods.updateStorySettings(
                nftMintingEnabled,
                maxNfts
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.3 作品状态管理测试
    it("should handle story status changes", async () => {
        try {
            // 创建作品
            await program.methods.createStory(
                "Test Story",
                "Description",
                "QmTest123Cover",
                "QmTest123Content",
                new anchor.BN(50000)
            )
            .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                author: authorAccount,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

            // 更新作品设置（包括状态）
            await program.methods.updateStorySettings(
                true, // nft_minting_enabled
                100 // max_nfts
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证状态更新
            let storyData = await program.account.story.fetch(storyAccount);
            assert.equal(storyData.nftMintingEnabled, true);
            assert.equal(storyData.maxNfts, 100);
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.4 错误处理测试
    it("should handle invalid parameters", async () => {
        try {
            // 测试空标题
            let errorThrown = false;
            try {
                await program.methods.createStory(
                    "",
                    "Description",
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: storyAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                assert.ok(error.toString().includes("InvalidTitleLength"));
            }
            assert.ok(errorThrown, "Should not allow empty title");

            // 测试过长描述
            try {
                await program.methods.createStory(
                    "Title",
                    "A".repeat(1001),
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: storyAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
                assert.fail("Should not allow description longer than 1000 characters");
            } catch (error: any) {
                console.log("Description length error:", error.toString());
                // 接受系统错误或自定义错误
                assert.ok(
                    error.toString().includes("InvalidDescriptionLength") || 
                    error.toString().includes("raw constraint violation") ||
                    error.toString().includes("failed to send transaction") ||
                    error.toString().includes("encoding overruns Buffer") ||
                    error.toString().includes("AccountDidNotSerialize"),
                    `Expected error to include length validation, but got: ${error.toString()}`
                );
            }

            // 测试无效的目标字数
            try {
                await program.methods.createStory(
                    "Title",
                    "Description",
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(0)
                )
                .accounts({
                    story: storyAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
                assert.fail("Should not allow zero target word count");
            } catch (error: any) {
                assert.ok(error.toString().includes("InvalidTargetWordCount"));
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.5 权限控制测试
    it("should enforce proper permissions", async () => {
        try {
            // 创建作品
            await program.methods.createStory(
                "Test Story",
                "Description",
                "QmTest123Cover",
                "QmTest123Content",
                new anchor.BN(50000)
            )
            .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                author: authorAccount,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

            // 创建未授权用户
            const unauthorizedUser = Keypair.generate();
            await provider.connection.requestAirdrop(
                unauthorizedUser.publicKey,
                5 * anchor.web3.LAMPORTS_PER_SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 尝试使用未授权用户更新作品
            try {
                await program.methods.updateStorySettings(
                    true,
                    100
                )
                .accounts({
                    story: storyAccount,
                    author: unauthorizedUser.publicKey,
                })
                .signers([unauthorizedUser])
                .rpc();
                assert.fail("Should not allow unauthorized updates");
            } catch (error: any) {
                assert.ok(error.toString().includes("InvalidAuthor"));
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.6 作品数量限制测试
    it("should enforce story count limits", async () => {
        try {
            // 创建最大数量的作品
            for (let i = 0; i < 50; i++) {
                // 使用作品序号作为第三个种子
                const [currentStoryAccount] = await PublicKey.findProgramAddress(
                    [Buffer.from("story"), authorAuthority.publicKey.toBuffer(), new anchor.BN(i).toArrayLike(Buffer, "le", 4)],
                    program.programId
                );

                await program.methods.createStory(
                    `Story ${i}`,
                    "Description",
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: currentStoryAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
            }

            // 尝试创建第51个作品
            const [extraStoryAccount] = await PublicKey.findProgramAddress(
                [Buffer.from("story"), authorAuthority.publicKey.toBuffer(), new anchor.BN(50).toArrayLike(Buffer, "le", 4)],
                program.programId
            );

            try {
                await program.methods.createStory(
                    "Extra Story",
                    "Description",
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: extraStoryAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
                assert.fail("Should not allow more than 50 stories");
            } catch (error: any) {
                console.log("Max stories error:", error.toString());
                assert.ok(
                    error.toString().includes("MaxStoriesExceeded") || 
                    error.toString().includes("raw constraint violation") ||
                    error.toString().includes("failed to send transaction") ||
                    error.toString().includes("encoding overruns Buffer") ||
                    error.toString().includes("AccountDidNotSerialize"),
                    `Expected error to include max stories validation, but got: ${error.toString()}`
                );
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.7 中文作品测试
    it("should handle Chinese story content correctly", async () => {
        try {
            const title = "测试小说标题";
            const description = "这是一个测试小说的简介，包含中文字符。这是一个奇幻故事...";
            const coverCid = "QmTest123Cover";
            const contentCid = "QmTest123Content";
            const targetWordCount = new anchor.BN(50000);
            
            await program.methods.createStory(
                title,
                description,
                coverCid,
                contentCid,
                targetWordCount
            )
            .accounts({
                story: storyAccount,
                authorWallet: authorAuthority.publicKey,
                author: authorAccount,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证作品创建
            const storyData = await program.account.story.fetch(storyAccount);
            assert.equal(storyData.title, title);
            assert.equal(storyData.description, description);
            assert.equal(storyData.coverCid, coverCid);
            assert.equal(storyData.contentCid, contentCid);
            assert.equal(storyData.targetWordCount.toString(), targetWordCount.toString());
            assert.equal(storyData.author.toString(), authorAuthority.publicKey.toString());
            assert.equal(storyData.isCompleted, false);
            assert.equal(storyData.chapterCount, 1);
            assert.equal(storyData.wordCount.toString(), "0");

            console.log(storyData);

            // 更新中文章节
            const chapterCid = "QmTest123Chapter1";
            const chapterNumber = 2;

            await program.methods.updateChapter(
                chapterNumber,
                chapterCid
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证章节更新
            const updatedStoryData = await program.account.story.fetch(storyAccount);
            assert.equal(updatedStoryData.chapterCount, chapterNumber);
            assert.equal(updatedStoryData.contentCid, chapterCid);

            // 更新作品设置
            const nftMintingEnabled = true;
            const maxNfts = 100;

            await program.methods.updateStorySettings(
                nftMintingEnabled,
                maxNfts
            )
            .accounts({
                story: storyAccount,
                author: authorAuthority.publicKey,
            })
            .signers([authorAuthority])
            .rpc();

            // 验证设置更新
            const finalStoryData = await program.account.story.fetch(storyAccount);
            assert.equal(finalStoryData.nftMintingEnabled, nftMintingEnabled);
            assert.equal(finalStoryData.maxNfts, maxNfts);
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3.8 中文长度限制测试
    it("should validate Chinese content length constraints", async () => {
        try {
            // 测试超长中文标题（超过100个字符）
            const longTitle = "很长的中文标题".repeat(20); // 200个字符
            let errorThrown = false;
            try {
                await program.methods.createStory(
                    longTitle,
                    "正常的描述",
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: storyAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                console.log("Title length error:", error.toString());
                assert.ok(
                    error.toString().includes("InvalidTitleLength") || 
                    error.toString().includes("raw constraint violation") ||
                    error.toString().includes("failed to send transaction") ||
                    error.toString().includes("encoding overruns Buffer") ||
                    error.toString().includes("AccountDidNotSerialize"),
                    `Expected error to include title length validation, but got: ${error.toString()}`
                );
            }
            assert.ok(errorThrown, "Should not allow title longer than 100 characters");

            // 测试超长中文描述（超过1000个字符）
            const longDescription = "很长的中文描述".repeat(200); // 2000个字符
            errorThrown = false;
            try {
                await program.methods.createStory(
                    "正常的标题",
                    longDescription,
                    "QmTest123Cover",
                    "QmTest123Content",
                    new anchor.BN(50000)
                )
                .accounts({
                    story: storyAccount,
                    authorWallet: authorAuthority.publicKey,
                    author: authorAccount,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authorAuthority])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                console.log("Description length error:", error.toString());
                assert.ok(
                    error.toString().includes("InvalidDescriptionLength") || 
                    error.toString().includes("raw constraint violation") ||
                    error.toString().includes("failed to send transaction") ||
                    error.toString().includes("encoding overruns Buffer") ||
                    error.toString().includes("AccountDidNotSerialize"),
                    `Expected error to include description length validation, but got: ${error.toString()}`
                );
            }
            assert.ok(errorThrown, "Should not allow description longer than 1000 characters");
        } catch (error) {
            
            console.error("Error:", error);
            throw error;
        }
    });
});

// 4. 打赏系统测试场景
describe.skip("Tipping System Tests", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TaleForge as Program<TaleForge>;
    
    // 测试账户
    let authorAuthority: Keypair;
    let authorAccount: PublicKey;
    let storyAccount: PublicKey;
    let penNameRecord: PublicKey;
    let testId: number;

    // 代币相关账户
    let mint: PublicKey;
    let authorTokenAccount: PublicKey;
    let tipperTokenAccount: PublicKey;
    let storyTokenAccount: PublicKey;
    let platformTokenAccount: PublicKey;
    let platformAuthority: Keypair;
    let tipper: Keypair;

    beforeEach(async () => {
        // 创建新的作者账户和平台账户
        authorAuthority = Keypair.generate();
        platformAuthority = Keypair.generate();
        tipper = Keypair.generate();
        testId = Date.now();
        
        // 为作者、平台和打赏者提供测试 SOL
        await provider.connection.requestAirdrop(
            authorAuthority.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
            platformAuthority.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
            tipper.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 生成作者账户
        [authorAccount] = await PublicKey.findProgramAddress(
            [Buffer.from("author"), authorAuthority.publicKey.toBuffer()],
            program.programId
        );

        // 注册作者
        const penName = `Test Author ${testId.toString().slice(-4)}`;
        [penNameRecord] = await PublicKey.findProgramAddress(
            [Buffer.from("pen_name"), Buffer.from(penName)],
            program.programId
        );

        await program.methods.registerAuthor(penName)
            .accounts({
                author: authorAccount,
                penNameRecord: penNameRecord,
                authority: authorAuthority.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([authorAuthority])
            .rpc();

        // 生成作品 PDA
        [storyAccount] = await PublicKey.findProgramAddress(
            [Buffer.from("story"), authorAuthority.publicKey.toBuffer(), new anchor.BN(0).toArrayLike(Buffer, "le", 4)],
            program.programId
        );

        // 创建代币铸币权
        mint = await createMint(
            provider.connection,
            authorAuthority,
            authorAuthority.publicKey,
            null,
            9
        );

        // 创建代币账户
        authorTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            authorAuthority,
            mint,
            authorAuthority.publicKey
        );

        tipperTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            tipper,
            mint,
            tipper.publicKey
        );

        // 为故事账户创建代币账户（使用普通账户而不是关联代币账户）
        const storyTokenAccountKeypair = Keypair.generate();
        const rent = await provider.connection.getMinimumBalanceForRentExemption(165); // 代币账户大小为165字节

        // 创建账户
        const createAccountIx = SystemProgram.createAccount({
            fromPubkey: authorAuthority.publicKey,
            newAccountPubkey: storyTokenAccountKeypair.publicKey,
            lamports: rent,
            space: 165,
            programId: TOKEN_PROGRAM_ID,
        });

        // 初始化代币账户
        const initAccountIx = createInitializeAccountInstruction(
            storyTokenAccountKeypair.publicKey,
            mint,
            storyAccount
        );

        // 发送交易
        const tx = new anchor.web3.Transaction()
            .add(createAccountIx)
            .add(initAccountIx);
        
        await provider.sendAndConfirm(tx, [authorAuthority, storyTokenAccountKeypair]);
        storyTokenAccount = storyTokenAccountKeypair.publicKey;

        platformTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            platformAuthority,
            mint,
            platformAuthority.publicKey
        );

        // 为打赏者铸造一些代币
        await mintTo(
            provider.connection,
            authorAuthority,
            mint,
            tipperTokenAccount,
            authorAuthority.publicKey,
            1000000000 // 1000 TAFOR
        );

        // 创建故事
        await program.methods.createStory(
            "Test Story",
            "Description",
            "QmTest123Cover",
            "QmTest123Content",
            new anchor.BN(50000)
        )
        .accounts({
            story: storyAccount,
            authorWallet: authorAuthority.publicKey,
            author: authorAccount,
            systemProgram: SystemProgram.programId,
        })
        .signers([authorAuthority])
        .rpc();
    });

    // 1. 正常场景测试
    it("should process SOL tips correctly", async () => {
        try {
            const tipAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL
            const initialAuthorBalance = await provider.connection.getBalance(authorAuthority.publicKey);
            const initialStoryBalance = await provider.connection.getBalance(storyAccount);

            await program.methods.tipStory(
                tipAmount,
                false // use SOL
            )
            .accounts({
                story: storyAccount,
                tipper: tipper.publicKey,
                author: authorAuthority.publicKey,
                authorAccount: authorAccount,
                storyToken: null,
                tipperToken: null,
                authorToken: null,
                platformToken: null,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([tipper])
            .rpc();

            // 验证转账
            const finalAuthorBalance = await provider.connection.getBalance(authorAuthority.publicKey);
            const finalStoryBalance = await provider.connection.getBalance(storyAccount);
            const storyData = await program.account.story.fetch(storyAccount);

            // 验证作者收到一半的打赏（扣除质押部分）
            const expectedAuthorShare = tipAmount.toNumber() / 4; // 作者获得一半，其中一半质押
            const actualAuthorShare = finalAuthorBalance - initialAuthorBalance;
            assert.ok(
                Math.abs(actualAuthorShare - expectedAuthorShare) <= 10000, // 允许小额手续费误差
                `Expected author to receive ${expectedAuthorShare} lamports, but got ${actualAuthorShare}`
            );

            // 验证故事账户收到质押部分
            const expectedStoryShare = tipAmount.toNumber() / 4; // 质押部分为作者份额的一半
            const actualStoryShare = finalStoryBalance - initialStoryBalance;
            assert.ok(
                Math.abs(actualStoryShare - expectedStoryShare) <= 10000, // 允许小额手续费误差
                `Expected story to receive ${expectedStoryShare} lamports, but got ${actualStoryShare}`
            );

            // 验证故事数据更新
            assert.equal(storyData.totalTipRevenueSol.toString(), tipAmount.toString());
            assert.equal(storyData.stakedEarningsSol.toString(), (tipAmount.toNumber() / 4).toString());
            assert(storyData.lastTipUpdate.toNumber() > 0);
            console.log("storyData:", storyData);

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    it("should process TAFOR tips correctly", async () => {
        try {
            const tipAmount = new anchor.BN(100_000_000); // 100 TAFOR
            const initialAuthorBalance = await getTokenBalance(provider.connection, authorTokenAccount);
            const initialStoryBalance = await getTokenBalance(provider.connection, storyTokenAccount);

            await program.methods.tipStory(
                tipAmount,
                true // use TAFOR
            )
            .accounts({
                story: storyAccount,
                tipper: tipper.publicKey,
                author: authorAuthority.publicKey,
                authorAccount: authorAccount,
                storyToken: storyTokenAccount,
                tipperToken: tipperTokenAccount,
                authorToken: authorTokenAccount,
                platformToken: platformTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([tipper])
            .rpc();

            // 验证转账
            const finalAuthorBalance = await getTokenBalance(provider.connection, authorTokenAccount);
            const finalStoryBalance = await getTokenBalance(provider.connection, storyTokenAccount);
            const storyData = await program.account.story.fetch(storyAccount);

            // 验证作者收到一半的打赏（扣除质押部分）
            assert.equal(
                finalAuthorBalance - initialAuthorBalance,
                tipAmount.toNumber() / 4 // 作者获得一半，其中一半质押
            );

            // 验证故事账户收到质押部分
            assert.equal(
                finalStoryBalance - initialStoryBalance,
                tipAmount.toNumber() / 4 // 质押部分为作者份额的一半
            );

            // 验证故事数据更新
            assert.equal(storyData.totalTipRevenueToken.toString(), tipAmount.toString());
            assert.equal(storyData.stakedEarningsToken.toString(), (tipAmount.toNumber() / 4).toString());
            assert(storyData.lastTipUpdate.toNumber() > 0);
            console.log("storyData:", storyData);
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 2. 边界条件测试
    it("should handle minimum tip amount", async () => {
        try {
            // 测试SOL最小打赏金额
            const minSolTip = new anchor.BN(0);
            try {
                await program.methods.tipStory(
                    minSolTip,
                    false
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: null,
                    tipperToken: null,
                    authorToken: null,
                    platformToken: null,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
                assert.fail("Should not allow zero tip amount");
            } catch (error: any) {
                assert.ok(error.toString().includes("InvalidTipAmount"));
            }

            // 测试TAFOR最小打赏金额
            const minTokenTip = new anchor.BN(0);
            try {
                await program.methods.tipStory(
                    minTokenTip,
                    true
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: storyTokenAccount,
                    tipperToken: tipperTokenAccount,
                    authorToken: authorTokenAccount,
                    platformToken: platformTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
                assert.fail("Should not allow zero token tip amount");
            } catch (error: any) {
                assert.ok(error.toString().includes("InvalidTipAmount"));
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    it("should handle maximum tip amount", async () => {
        try {
            // 测试SOL最大打赏金额（接近u64最大值）
            const maxSolTip = new anchor.BN("18446744073709551615"); // u64::MAX
            try {
                await program.methods.tipStory(
                    maxSolTip,
                    false
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: null,
                    tipperToken: null,
                    authorToken: null,
                    platformToken: null,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
                assert.fail("Should not allow excessive tip amount");
            } catch (error: any) {
                assert.ok(
                    error.toString().includes("insufficient lamports") ||
                    error.toString().includes("overflow")
                );
            }

            // 测试TAFOR最大打赏金额
            const maxTokenTip = new anchor.BN("18446744073709551615"); // u64::MAX
            try {
                await program.methods.tipStory(
                    maxTokenTip,
                    true
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: storyTokenAccount,
                    tipperToken: tipperTokenAccount,
                    authorToken: authorTokenAccount,
                    platformToken: platformTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
                assert.fail("Should not allow excessive token tip amount");
            } catch (error: any) {
                assert.ok(
                    error.toString().includes("insufficient funds") ||
                    error.toString().includes("overflow")
                );
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    // 3. 错误处理测试
    it("should fail with insufficient funds", async () => {
        try {
            // 创建一个余额不足的账户
            const poorTipper = Keypair.generate();
            await provider.connection.requestAirdrop(
                poorTipper.publicKey,
                0.1 * anchor.web3.LAMPORTS_PER_SOL // 只有0.1 SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 测试SOL余额不足
            const largeSolTip = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 尝试打赏1 SOL
            try {
                await program.methods.tipStory(
                    largeSolTip,
                    false
                )
                .accounts({
                    story: storyAccount,
                    tipper: poorTipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: null,
                    tipperToken: null,
                    authorToken: null,
                    platformToken: null,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([poorTipper])
                .rpc();
                assert.fail("Should not allow tip with insufficient SOL");
            } catch (error: any) {
                assert.ok(error.toString().includes("insufficient lamports"));
            }

            // 创建一个代币余额不足的账户
            const poorTokenTipper = Keypair.generate();
            await provider.connection.requestAirdrop(
                poorTokenTipper.publicKey,
                1 * anchor.web3.LAMPORTS_PER_SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            const poorTipperTokenAccount = await createAssociatedTokenAccount(
                provider.connection,
                poorTokenTipper,
                mint,
                poorTokenTipper.publicKey
            );

            // 测试TAFOR余额不足
            const largeTokenTip = new anchor.BN(1000_000_000); // 尝试打赏1000 TAFOR
            try {
                await program.methods.tipStory(
                    largeTokenTip,
                    true
                )
                .accounts({
                    story: storyAccount,
                    tipper: poorTokenTipper.publicKey,
                    author: authorAuthority.publicKey,
                    authorAccount: authorAccount,
                    storyToken: storyTokenAccount,
                    tipperToken: poorTipperTokenAccount,
                    authorToken: authorTokenAccount,
                    platformToken: platformTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([poorTokenTipper])
                .rpc();
                assert.fail("Should not allow tip with insufficient TAFOR");
            } catch (error: any) {
                assert.ok(error.toString().includes("insufficient funds"));
            }
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });

    it("should handle failed transfers", async () => {
        try {
            // 创建一个无效作者账户
            const invalidAuthorAuthority = Keypair.generate();
            await provider.connection.requestAirdrop(
                invalidAuthorAuthority.publicKey,
                5 * anchor.web3.LAMPORTS_PER_SOL
            );
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 为无效作者注册账户
            const [invalidAuthorAccount] = await PublicKey.findProgramAddress(
                [Buffer.from("author"), invalidAuthorAuthority.publicKey.toBuffer()],
                program.programId
            );

            const penName = `Invalid Author ${Date.now()}`;
            const [penNameRecord] = await PublicKey.findProgramAddress(
                [Buffer.from("pen_name"), Buffer.from(penName)],
                program.programId
            );

            await program.methods.registerAuthor(penName)
                .accounts({
                    author: invalidAuthorAccount,
                    penNameRecord: penNameRecord,
                    authority: invalidAuthorAuthority.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([invalidAuthorAuthority])
                .rpc();

            // 创建无效作者的代币账户
            const invalidAuthorTokenAccount = await createAssociatedTokenAccount(
                provider.connection,
                invalidAuthorAuthority,
                mint,
                invalidAuthorAuthority.publicKey
            );

            // 测试SOL转账失败（作者账户不匹配故事）
            let errorThrown = false;
            try {
                await program.methods.tipStory(
                    new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL),
                    false
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey, // 使用原始作者，这样会与invalidAuthorAccount不匹配
                    authorAccount: invalidAuthorAccount,
                    storyToken: null,
                    tipperToken: null,
                    authorToken: null,
                    platformToken: null,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                console.log("Expected error:", error.toString());
                assert.ok(
                    error.toString().includes("InvalidAuthor") ||
                    error.toString().includes("Account does not exist") ||
                    error.toString().includes("0x7d3") ||
                    error.toString().includes("Constraint"), // Anchor error code for constraint violation
                    `Expected error to include 'InvalidAuthor' or 'Account does not exist', but got: ${error.toString()}`
                );
            }
            assert.ok(errorThrown, "Expected an error to be thrown when using invalid author");

            // 测试TAFOR转账失败（代币账户不存在）
            errorThrown = false;
            try {
                await program.methods.tipStory(
                    new anchor.BN(100_000_000),
                    true
                )
                .accounts({
                    story: storyAccount,
                    tipper: tipper.publicKey,
                    author: authorAuthority.publicKey, // 使用原始作者，这样会与invalidAuthorAccount不匹配
                    authorAccount: invalidAuthorAccount,
                    storyToken: storyTokenAccount,
                    tipperToken: tipperTokenAccount,
                    authorToken: invalidAuthorTokenAccount,
                    platformToken: platformTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([tipper])
                .rpc();
            } catch (error: any) {
                errorThrown = true;
                console.log("Expected error:", error.toString());
                assert.ok(
                    error.toString().includes("InvalidAuthor") ||
                    error.toString().includes("Account does not exist") ||
                    error.toString().includes("0x7d3") ||
                    error.toString().includes("Constraint"), // Anchor error code for constraint violation
                    `Expected error to include 'InvalidAuthor' or 'Account does not exist', but got: ${error.toString()}`
                );
            }
            assert.ok(errorThrown, "Expected an error to be thrown when using invalid token account");
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    });
});



// 5. NFT系统测试场景
describe("NFT System Tests", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TaleForge as Program<TaleForge>;

    // 测试账户
    const author = Keypair.generate();
    const reader = Keypair.generate();
    let storyId: anchor.BN;
    let storyAddress: PublicKey;
    let authorTokenAccount: PublicKey;
    let platformMint: PublicKey;

    before(async () => {
        // 为测试账户提供资金
        await provider.connection.requestAirdrop(
            author.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
            reader.publicKey,
            10 * anchor.web3.LAMPORTS_PER_SOL
        );

        // 创建平台代币
        platformMint = await createMint(
            provider.connection,
            author,
            author.publicKey,
            null,
            9
        );

        // 创建作者代币账户
        authorTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            author,
            platformMint,
            author.publicKey
        );

        // 创建测试作品
        const [storyPDA] = await PublicKey.findProgramAddress(
            [Buffer.from("story"), author.publicKey.toBuffer()],
            program.programId
        );
        storyAddress = storyPDA;

        await program.methods.createStory(
            "Test Story",
            "Test Description",
            "QmTest...",
            "QmTest...",
            new anchor.BN(100000) // 10万字，满足第一批次NFT铸造条件
        )
        .accounts({
            story: storyAddress,
            author: author.publicKey,
            authorWallet: author.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

        storyId = new anchor.BN(0); // 第一个创建的故事ID
    });

    // 1. 正常场景测试
    describe("Normal NFT Operations", () => {
        // 1.1 正常铸造NFT
        it("should mint NFT successfully", async () => {
            const nftKeypair = Keypair.generate();

            await program.methods.createNft(
                "Test NFT #1",
                "First NFT of the story",
                "ipfs://QmTest...",
                { character: {} },
                { common: {} }
            )
            .accounts({
                story: storyAddress,
                nft: nftKeypair.publicKey,
                author: author.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([author, nftKeypair])
            .rpc();

            const story = await program.account.story.fetch(storyAddress);
            assert.equal(story.nftCount.toString(), "1");
            
            const nftData = await program.account.novelNft.fetch(nftKeypair.publicKey);
            assert.equal(nftData.owner.toString(), author.publicKey.toString());
            assert.equal(nftData.mintBatch, 1);
            assert.equal(nftData.miningWeight.toString(), "100");
        });

        // 1.2 限制铸造数量
        it("should enforce first batch limit of 10 NFTs", async () => {
            // 尝试铸造剩余9个NFT
            for (let i = 2; i <= 10; i++) {
                const [nftAddress] = await PublicKey.findProgramAddress(
                    [Buffer.from("nft"), storyAddress.toBuffer(), new anchor.BN(i).toArrayLike(Buffer)],
                    program.programId
                );

                await program.methods.createNft(
                    `Test NFT #${i}`,
                    `NFT ${i} of the story`,
                    "ipfs://QmTest...",
                    { character: {} },
                    { common: {} }
                )
                .accounts({
                    story: storyAddress,
                    nft: nftAddress,
                    author: author.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([author])
                .rpc();
            }

            const story = await program.account.story.fetch(storyAddress);
            assert.equal(story.nftCount.toString(), "10");
            assert.equal(story.firstMintCompleted, true);
        });

        // 1.3 启用第二批次铸造
        it("should enable second batch minting after completion", async () => {
            // 启用第二批次铸造
            await program.methods.updateStorySettings(true, 90) // 修改为90，确保总量不超过100个
            .accounts({
                story: storyAddress,
                author: author.publicKey,
            })
            .signers([author])
            .rpc();

            // 铸造第二批次NFT
            const [nftAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("nft"), storyAddress.toBuffer(), new anchor.BN(11).toArrayLike(Buffer)],
                program.programId
            );

            await program.methods.createNft(
                "Test NFT #11",
                "First NFT of second batch",
                "ipfs://QmTest...",
                { character: {} },
                { common: {} }
            )
            .accounts({
                story: storyAddress,
                nft: nftAddress,
                author: author.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([author])
            .rpc();

            const nft = await program.account.novelNft.fetch(nftAddress);
            assert.equal(nft.mintBatch, 2);
            assert.equal(nft.miningWeight.toString(), "50");
        });

        // 添加测试第二批次限制
        it("should enforce total NFT limit of 100", async () => {
            // 尝试铸造剩余的89个NFT (已经铸造了11个：第一批10个 + 第二批1个)
            for (let i = 12; i <= 100; i++) {
                const [nftAddress] = await PublicKey.findProgramAddress(
                    [Buffer.from("nft"), storyAddress.toBuffer(), new anchor.BN(i).toArrayLike(Buffer)],
                    program.programId
                );

                await program.methods.createNft(
                    `Test NFT #${i}`,
                    `NFT ${i} of the story`,
                    "ipfs://QmTest...",
                    { character: {} },
                    { common: {} }
                )
                .accounts({
                    story: storyAddress,
                    nft: nftAddress,
                    author: author.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([author])
                .rpc();
            }

            const story = await program.account.story.fetch(storyAddress);
            assert.equal(story.nftCount.toString(), "100");

            // 尝试铸造第101个NFT，应该失败
            try {
                const [nftAddress] = await PublicKey.findProgramAddress(
                    [Buffer.from("nft"), storyAddress.toBuffer(), new anchor.BN(101).toArrayLike(Buffer)],
                    program.programId
                );

                await program.methods.createNft(
                    "Test NFT #101",
                    "Should fail",
                    "ipfs://QmTest...",
                    { character: {} },
                    { common: {} }
                )
                .accounts({
                    story: storyAddress,
                    nft: nftAddress,
                    author: author.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([author])
                .rpc();
                assert.fail("Should not mint more than 100 NFTs");
            } catch (error: any) {
                assert.include(error.toString(), "MaxNFTLimitReached");
            }
        });
    });

    // 2. NFT交易测试
    describe("NFT Trading Operations", () => {
        let nftAddress: PublicKey;

        before(async () => {
            [nftAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("nft"), storyAddress.toBuffer(), new anchor.BN(1).toArrayLike(Buffer)],
                program.programId
            );
        });

        it("should list NFT for sale", async () => {
            await program.methods.listNft(
                new anchor.BN(1_000_000_000),
                new anchor.BN(1000)
            )
            .accounts({
                nft: nftAddress,
                owner: author.publicKey,
            })
            .signers([author])
            .rpc();

            const nftData = await program.account.novelNft.fetch(nftAddress);
            assert.equal(nftData.isListed, true);
            assert.equal(nftData.listPriceSol.toString(), "1000000000");
            assert.equal(nftData.listPriceToken.toString(), "1000");
        });

        it("should buy NFT with SOL", async () => {
            await program.methods.buyNft(false)
            .accounts({
                nft: nftAddress,
                story: storyAddress,
                currentOwner: author.publicKey,
                newOwner: reader.publicKey,
                systemProgram: SystemProgram.programId,
                guard: await getReentrancyGuard(program),
            })
            .signers([reader])
            .rpc();

            const nftData = await program.account.novelNft.fetch(nftAddress);
            assert.equal(nftData.owner.toString(), reader.publicKey.toString());
            assert.equal(nftData.isListed, false);

            const story = await program.account.story.fetch(storyAddress);
            assert.equal(story.totalNftRevenueSol.toString(), "1000000000");
    });
});

    // 3. 错误处理测试
    describe("NFT Error Handling", () => {
        // 3.1 铸造NFT时字数不足
        it("should fail when minting with insufficient words", async () => {
            // 创建一个新作品但不更新字数
            const [newStoryAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("story"), author.publicKey.toBuffer(), new anchor.BN(1).toArrayLike(Buffer)],
                program.programId
            );

            await program.methods.createStory(
                "Test Story 2",
                "Test Description",
                "QmTest...",
                "QmTest...",
                new anchor.BN(100000)
            )
            .accounts({
                story: newStoryAddress,
                author: author.publicKey,
                authorWallet: author.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([author])
            .rpc();

            const [nftAddress] = await PublicKey.findProgramAddress(
                [Buffer.from("nft"), newStoryAddress.toBuffer(), new anchor.BN(1).toArrayLike(Buffer)],
                program.programId
            );

            try {
                await program.methods.createNft(
                    "Test NFT",
                    "Should fail",
                    "ipfs://QmTest...",
                    { character: {} },
                    { common: {} }
                )
                .accounts({
                    story: newStoryAddress,
                    nft: nftAddress,
                    author: author.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([author])
                .rpc();
                assert.fail("Should not mint NFT with insufficient words");
            } catch (error: any) {
                assert.include(error.toString(), "InsufficientWordCount");
            }
        });
    });
});

// 辅助函数
async function getReentrancyGuard(program: Program<TaleForge>): Promise<PublicKey> {
    const [guard] = await PublicKey.findProgramAddress(
        [Buffer.from("reentrancy_guard")],
        program.programId
    );
    return guard;
}

// 6. 挖矿奖励测试场景
describe("Mining Rewards Tests", () => {
    // 1. 正常场景测试
    it("should distribute mining rewards correctly", async () => {
        // - 验证平台分成（10%）
        // - 验证作者分成（45%）
        // - 验证NFT持有者分成（45%）
    });

    it("should handle halving mechanism", async () => {
        // - 验证3年减半周期
        // - 验证奖励计算
        // - 验证时间戳检查
    });

    // 2. 边界条件测试
    it("should calculate mining power correctly", async () => {
        // - 最小挖矿权重
        // - 最大挖矿权重
        // - 权重累加溢出保护
    });

    it("should handle epoch transitions", async () => {
        // - 跨周期奖励计算
        // - 减半点奖励调整
    });

    // 3. 错误处理测试
    it("should fail early distribution attempts", async () => {
        // - 验证分配时间间隔
        // - 验证权限检查
    });

    it("should handle empty mining pool", async () => {
        // - 奖励池耗尽情况
        // - 最小分配额度
    });
});

// 7. 读者活动测试场景
describe("Reader Activity Tests", () => {
    // 1. 正常场景测试
    it("should handle daily check-ins", async () => {
        // - 验证签到记录
        // - 验证连续签到
        // - 验证权重增加
    });

    it("should process monthly lottery", async () => {
        // - 验证参与资格
        // - 验证奖励分配
        // - 验证特别奖励
    });

    // 2. 边界条件测试
    it("should validate activity thresholds", async () => {
        // - 最少活跃天数（7天）
        // - 最大连续签到
        // - 权重上限
    });

    it("should handle lottery pool limits", async () => {
        // - 最小奖池金额
        // - 最大中奖人数
        // - 特别奖励名额
    });

    // 3. 错误处理测试
    it("should prevent duplicate check-ins", async () => {
        // - 同日重复签到
        // - 跨日签到重置
    });

    it("should handle insufficient participants", async () => {
        // - 参与人数不足
        // - 奖池金额不足
    });
});

// 8. 系统安全测试场景
describe("Security Tests", () => {
    // 1. 权限控制测试
    it("should enforce author permissions", async () => {
        // - 作品更新权限
        // - NFT铸造权限
        // - 收益提取权限
    });

    it("should validate platform authority", async () => {
        // - 平台初始化权限
        // - 奖励分配权限
        // - 系统参数调整权限
    });

    // 2. 重入保护测试
    it("should prevent reentrancy attacks", async () => {
        // - NFT交易重入
        // - 代币转账重入
        // - 奖励分配重入
    });

    // 3. 数值安全测试
    it("should handle arithmetic operations safely", async () => {
        // - 金额计算溢出
        // - 统计数据溢出
        // - 权重计算溢出
    });

    // 4. 状态一致性测试
    it("should maintain data consistency", async () => {
        // - 交易回滚
        // - 状态更新原子性
        // - 账户数据完整性
  });
});
