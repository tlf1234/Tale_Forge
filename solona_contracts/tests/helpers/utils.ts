import * as anchor from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { createMint, createAccount } from "@solana/spl-token";

export async function createTestToken(
    provider: anchor.AnchorProvider,
    authority: Keypair,
    decimals: number = 9
) {
    const mint = await createMint(
        provider.connection,
        authority,
        authority.publicKey,
        null,
        decimals
    );
    return mint;
}

export async function createTestTokenAccount(
    provider: anchor.AnchorProvider,
    mint: PublicKey,
    owner: PublicKey
) {
    return await createAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        owner
    );
}
