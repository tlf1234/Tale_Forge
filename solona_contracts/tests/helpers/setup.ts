// tests/helpers/setup.ts
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TaleForge } from "../../target/types/tale_forge";

import { Keypair } from "@solana/web3.js";

export async function setupTestEnvironment() {
    // 1. 设置测试网络连接
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // 2. 加载程序
    const program = anchor.workspace.TaleForge as Program<TaleForge>;

    // 3. 创建测试账户
    const testAuthority = Keypair.generate();
    
    // 4. 提供测试 SOL
    await provider.connection.requestAirdrop(
        testAuthority.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
    );

    return {
        provider,
        program,
        testAuthority
    };
}