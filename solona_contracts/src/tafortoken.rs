use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// 代币基本信息
pub const TAFOR_DECIMALS: u8 = 9;
pub const TAFOR_SYMBOL: &str = "TAFOR";
pub const TAFOR_NAME: &str = "TaleForge Token";

// 代币等级系统
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TaforLevel {
    Spark,     // 初始火花
    Shine,     // 稳定发光
    Radiant,   // 光芒四射
    Brilliant, // 璀璨夺目
    Luminous   // 永恒之光
}

// 代币账户结构
#[account]
pub struct TaforAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub level: TaforLevel,
    pub staked_amount: u64,
    pub last_stake_time: i64,
    pub total_earned: u64,
}

// 代币相关事件
#[event]
pub struct TokenMinted {
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenBurned {
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenStaked {
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokenUnstaked {
    pub owner: Pubkey,
    pub amount: u64,
    pub rewards: u64,
    pub timestamp: i64,
}

// 代币错误类型
#[error_code]
pub enum TokenError {
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Stake still locked")]
    StakeLocked,
    #[msg("Invalid unstake amount")]
    InvalidUnstakeAmount,
}

// 添加 TokenPayment 结构体
#[derive(Accounts)]
pub struct TaforPayment<'info> {
    #[account(mut)]
    /// CHECK: This account is checked in the CPI call to token program
    pub from: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: This account is checked in the CPI call to token program
    pub to: AccountInfo<'info>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> TaforPayment<'info> {
    pub fn process_payment(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.from.clone(),
            to: self.to.clone(),
            authority: self.authority.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

// 添加代币铸造相关结构
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = authority,
        mint::decimals = TAFOR_DECIMALS,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTo<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// 添加代币分配相关结构
#[derive(Accounts)]
pub struct InitialDistribution<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub mining_pool: Account<'info, TokenAccount>,
    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
} 