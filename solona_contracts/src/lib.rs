use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::get_associated_token_address;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::clock::Clock;
use solana_program::pubkey;  // 添加 pubkey 宏导入
use solana_program::program::invoke;
use solana_program::system_instruction;
use solana_program::account_info::AccountInfo;
use solana_program::pubkey::Pubkey;
use solana_program::program_pack::Pack;
use solana_program::sysvar::Sysvar;
use anchor_lang::Discriminator; // 添加这一行

pub mod tafortoken;
use tafortoken::*;

declare_id!("ABj6apyfCsUTvRqTGg4eBFL7jrhR3KFCNJWiDNfWYvDx");

// 平台权限地址
// pub const PLATFORM_AUTHORITY: Pubkey = pubkey!("11111111111111111111111111111111");

// 添加挖矿相关常量和结构
const TOTAL_SUPPLY: u64 = 1_000_000_000;  // 总量10亿
const INITIAL_WEEKLY_REWARD: u64 = TOTAL_SUPPLY / (52 * 3); // 每周初始奖励
const HALVING_PERIOD: i64 = 3 * 365 * 24 * 60 * 60; // 3年减半周期（秒）
const PLATFORM_SHARE: u8 = 10;  // 平台分成10%
const AUTHOR_SHARE: u8 = 45;    // 作者分成45%
const NFT_HOLDERS_SHARE: u8 = 45; // NFT持有者分成45%

//下面的是参数优化，与原来的有重复
// 挖矿周期和奖励
// const WEEKLY_RESET_BUFFER: i64 = 24 * 60 * 60;  // 24小时重置缓冲期
// const BURST_BONUS_MULTIPLIER: u64 = 3;          // 爆发期3倍算力
// const MIN_WORDS_PER_CHAPTER: u64 = 2000;        // 每章最少2000字

// // 代币经济模型
// const INITIAL_SUPPLY: u64 = 1_000_000_000;      // 10亿初始供应
// const FIRST_HALVING_REWARD: u64 = INITIAL_SUPPLY * 4 / 10;  // 首期40%投入挖矿
// const WEEKLY_EMISSION: u64 = FIRST_HALVING_REWARD / (3 * 52); // 每周发放量
// const TREASURY_RESERVE: u64 = INITIAL_SUPPLY * 1 / 10;  // 10%储备金



// NFT铸造和奖励
const MAX_NFTS_PER_STORY: u32 = 100;           // 每个作品最多100个NFT，可以铸造2次
const NFT_RARITY_WEIGHTS: [u32; 4] = [
    650,    // Common   65%
    250,    // Rare     25%
    80,     // Epic     8%
    20      // Legendary 2%
];
const DAY_IN_SECONDS: i64 = 24 * 60 * 60;

// 将常量移到模块外部
const MIN_ACTIVE_DAYS_FOR_LOTTERY: u8 = 7;     // 最少7天活跃才能参与抽奖
const LOTTERY_WINNER_PERCENTAGE: u32 = 3;      // 3%中奖率
const LOTTERY_EXTRA_PRIZE_COUNT: u32 = 10;      // 10个特等奖

// 添加作品约束相关常量
const MIN_MINING_WORDS: u64 = 50_000;           // 最少5万字才能参与挖矿
const ABANDONED_PLATFORM_SHARE: u8 = 20;        // 太监作品平台分成20%
const MAX_INACTIVE_DAYS: i64 = 30;              // 30天不更新视为太监

// 添加固定汇率常量
const TAFOR_PRICE_IN_LAMPORTS: u64 = LAMPORTS_PER_SOL;  // 1 TAFOR = 1 SOL

#[program]
pub mod tale_forge {
    use super::*;

    // 初始化平台
    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        // 初始化挖矿池
        let mining_pool = &mut ctx.accounts.mining_pool;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        
        mining_pool.start_time = current_time;
        mining_pool.last_reward_time = current_time;
        mining_pool.total_distributed = 0;
        mining_pool.current_epoch = 0;
        mining_pool.total_mining_power = 0;
        mining_pool.total_amount = TOTAL_SUPPLY;  // 所有代币都通过挖矿获得
        mining_pool.token_mint = ctx.accounts.mint.key();

        // 初始化读者奖励池
        let reader_pool = &mut ctx.accounts.reader_reward_pool;
        reader_pool.total_amount = 0;
        reader_pool.last_lottery_time = current_time;
        reader_pool.active_readers = 0;
        reader_pool.token_mint = ctx.accounts.mint.key();

        // 铸造初始代币供应量到挖矿池
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.mining_pool_token.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            TOTAL_SUPPLY,  // 所有代币都进入挖矿池
        )?;

        emit!(PlatformInitialized {
            mining_pool: ctx.accounts.mining_pool.key(),
            reader_reward_pool: ctx.accounts.reader_reward_pool.key(),
            mint: ctx.accounts.mint.key(),
            initial_mining_supply: TOTAL_SUPPLY,
            treasury_reserve: 0,  // 没有储备金
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // ******** 1. 作品创建及打赏相关 ********
    // 创建作品
    pub fn create_story(
        ctx: Context<CreateStory>,
        title: String,
        description: String,
        cover_cid: String,
        content_cid: String,
        target_word_count: u64,        // 新增：目标字数
    ) -> Result<()> {
        // 先验证
        Story::validate_title(&title)?;
        Story::validate_description(&description)?;
        Story::validate_cid(&cover_cid)?;
        Story::validate_cid(&content_cid)?;
        
        // 验证目标字数
        require!(target_word_count >= MIN_MINING_WORDS, TaleForgeError::InvalidTargetWordCount);

        let story = &mut ctx.accounts.story;
        story.title = title.clone();  // 克隆 title
        story.description = description;
        story.author = ctx.accounts.author_wallet.key();   //注意这个是钱包地址
        story.pen_name = ctx.accounts.author.pen_name.clone();
        story.cover_cid = cover_cid;
        story.content_cid = content_cid;
        story.chapter_count = 1;
        story.is_completed = false;
        story.created_at = Clock::get()?.unix_timestamp;
        story.updated_at = Clock::get()?.unix_timestamp;
        story.nft_count = 0;
        story.target_word_count = target_word_count;
        story.staked_earnings_sol = 0;
        story.staked_earnings_token = 0;
        story.is_abandoned = false;
        story.last_update_time = Clock::get()?.unix_timestamp;
        story.min_words_for_nft = 100_000;  // 默认设置为10万字
        story.max_nfts = 100;  // 默认设置为100个

        // 更新作者信息
        let author = &mut ctx.accounts.author;
        author.story_count += 1;
        author.stories.push(ctx.accounts.story.key());
        author.last_update = Clock::get()?.unix_timestamp;

        emit!(StoryCreated {
            story: ctx.accounts.story.key(),
            author: ctx.accounts.author.key(),
            title,  // 使用原始的 title
            target_words: target_word_count,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // 打赏作品
    pub fn tip_story(
        ctx: Context<TipStory>, 
        amount: u64,
        use_token: bool  // true: 使用 TAFOR, false: 使用 SOL
    ) -> Result<()> {
        require!(amount > 0, TaleForgeError::InvalidTipAmount);
        
        let author_share = amount / 2;  // 作者获得一半
        let stake_amount = author_share / 2;  // 作者份额的一半进行质押
        
        if use_token {
            // 使用 TAFOR 支付
            require!(
                ctx.accounts.tipper_token.is_some() && 
                ctx.accounts.author_token.is_some() &&
                ctx.accounts.story_token.is_some(),  // 添加故事质押账户
                TaleForgeError::TokenAccountsRequired
            );
            
            // 转移给作者的部分
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.tipper_token.as_ref().unwrap().to_account_info(),
                        to: ctx.accounts.author_token.as_ref().unwrap().to_account_info(),
                        authority: ctx.accounts.tipper.to_account_info(),
                    },
                ),
                author_share - stake_amount,  // 扣除质押部分
            )?;

            // 质押部分转入故事账户
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.tipper_token.as_ref().unwrap().to_account_info(),
                        to: ctx.accounts.story_token.as_ref().unwrap().to_account_info(),
                        authority: ctx.accounts.tipper.to_account_info(),  // 修改为使用 tipper 的权限
                    },
                ),
                stake_amount,
            )?;

            let story = &mut ctx.accounts.story;
            story.total_tip_revenue_token += amount;
            story.staked_earnings_token += stake_amount;
        } else {
            // 使用 SOL 支付
            let story_key = ctx.accounts.story.key();
            
            // 转移给作者的部分
            let transfer_sol = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.tipper.key(),
                &ctx.accounts.author.key(),
                author_share - stake_amount,
            );
            
            anchor_lang::solana_program::program::invoke(
                &transfer_sol,
                &[
                    ctx.accounts.tipper.to_account_info(),
                    ctx.accounts.author.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;

            // 质押部分转入故事账户
            let stake_sol = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.tipper.key(),
                &story_key,
                stake_amount,
            );
            
            let story_account_info = ctx.accounts.story.to_account_info();
            anchor_lang::solana_program::program::invoke(
                &stake_sol,
                &[
                    ctx.accounts.tipper.to_account_info(),
                    story_account_info,
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;

            let story = &mut ctx.accounts.story;
            story.total_tip_revenue_sol += amount;
            story.staked_earnings_sol += stake_amount;
        }

        let story = &mut ctx.accounts.story;
        story.last_tip_update = Clock::get()?.unix_timestamp;
        story.last_update_time = Clock::get()?.unix_timestamp;  // 更新最后活动时间

        // 更新作者收益统计
        let author = &mut ctx.accounts.author_account;  // 使用 author_account 而不是 author
        if use_token {
            author.total_earnings_token += author_share - stake_amount;
        } else {
            author.total_earnings_sol += author_share - stake_amount;
        }
        author.last_update = Clock::get()?.unix_timestamp;

        emit!(StoryTipped {
            story: story.key(),
            tipper: ctx.accounts.tipper.key(),
            amount,
            use_token,
            staked_amount: stake_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    // 更新章节
    pub fn update_chapter(
        ctx: Context<UpdateChapter>,
        chapter_number: u32,
        chapter_cid: String,
    ) -> Result<()> {
        let story = &mut ctx.accounts.story;
        Story::validate_cid(&chapter_cid)?;
        story.chapter_count = chapter_number;
        story.content_cid = chapter_cid;
        story.updated_at = Clock::get()?.unix_timestamp;
        
        emit!(ChapterUpdated {
            story: story.key(),
            chapter_number,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // 完成作品
    pub fn complete_story(ctx: Context<CompleteStory>) -> Result<()> {
        // 先获取所有需要的值
        let story_key = ctx.accounts.story.key();
        let story_account_info = ctx.accounts.story.to_account_info();
        let current_time = Clock::get()?.unix_timestamp;
        
        let story = &mut ctx.accounts.story;
        require!(!story.is_completed, TaleForgeError::StoryAlreadyCompleted);
        
        // 检查是否达到目标字数。（todo这里需要优化，作者没有达到目标字数，但是可以完成作品！！！！）
        require!(
            story.word_count >= story.target_word_count,
            TaleForgeError::TargetWordCountNotMet
        );

        // 获取质押金额，因为后面会修改这些值
        let staked_sol = story.staked_earnings_sol;
        let staked_token = story.staked_earnings_token;

        // 解锁SOL质押
        if staked_sol > 0 {
            let transfer_sol = anchor_lang::solana_program::system_instruction::transfer(
                &story_key,  // 从故事账户转出
                &ctx.accounts.author.key(),  // 转给作者
                staked_sol,
            );
            
            anchor_lang::solana_program::program::invoke(
                &transfer_sol,
                &[
                    story_account_info.clone(),
                    ctx.accounts.author.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;

            emit!(StakeReleased {
                story: story_key,
                author: ctx.accounts.author.key(),
                amount: staked_sol,
                use_token: false,
                timestamp: current_time,
            });

            story.staked_earnings_sol = 0;
        }

        // 解锁TAFOR质押
        if staked_token > 0 {
            require!(
                ctx.accounts.story_token.is_some() && ctx.accounts.author_token.is_some(),
                TaleForgeError::TokenAccountsRequired
            );

            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.story_token.as_ref().unwrap().to_account_info(),
                        to: ctx.accounts.author_token.as_ref().unwrap().to_account_info(),
                        authority: story_account_info,
                    },
                ),
                staked_token,
            )?;

            emit!(StakeReleased {
                story: story_key,
                author: ctx.accounts.author.key(),
                amount: staked_token,
                use_token: true,
                timestamp: current_time,
            });

            story.staked_earnings_token = 0;
        }

        story.is_completed = true;
        story.last_update_time = current_time;

        Ok(())
    }

    // ******** 2. 点赞、评论、字数更新相关 ********
    // 点赞作品
    pub fn like_story(ctx: Context<LikeStory>) -> Result<()> {
        let story = &mut ctx.accounts.story;
        story.like_count += 1;
       
        
        emit!(StoryLiked {
            story: story.key(),
            user: ctx.accounts.user.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // 评论作品
    pub fn add_comment(ctx: Context<AddComment>) -> Result<()> {
        let story = &mut ctx.accounts.story;
        story.comment_count += 1;
       
        
        emit!(StoryCommented {
            story: story.key(),
            user: ctx.accounts.user.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // 更新字数（链上只要更新字数即可）
    pub fn update_word_count(
        ctx: Context<UpdateWordCount>,
        new_words: u64    // 新增的字数
    ) -> Result<()> {
        let story = &mut ctx.accounts.story;
        let author = &mut ctx.accounts.author_account;  // 使用 author_account
        let current_time = Clock::get()?.unix_timestamp;
        const WEEK_IN_SECONDS: i64 = 7 * 24 * 60 * 60;

        // 检查是否需要重置周字数
        if current_time - story.last_word_reset >= WEEK_IN_SECONDS {
            story.weekly_word_count = 0;
            story.last_word_reset = current_time;
        }

        story.word_count += new_words;         // 更新总字数
        story.weekly_word_count += new_words;  // 更新周字数
        // 更新作者总字数
        author.total_word_count += new_words;
        author.last_update = current_time;

        emit!(WordCountUpdated {
            story: story.key(),
            total_words: story.word_count,
            weekly_words: story.weekly_word_count,
            author_total_words: author.total_word_count,  // 添加作者总字数
            timestamp: current_time,
        });

        Ok(())
    }


    // ******** 3. NFT相关 ********
    // 创建 NFT
    pub fn create_nft(
        ctx: Context<CreateNFT>,
        name: String,
        description: String,
        image_uri: String,
        nft_type: NFTType,
    ) -> Result<()> {
        let story = &mut ctx.accounts.story;
        let nft = &mut ctx.accounts.nft;
        

        // 检查第一次铸造条件
        if !story.first_mint_completed {
            require!(
                story.word_count >= story.min_words_for_nft,
                TaleForgeError::InsufficientWordCount
            );
            require!(
                story.nft_count < 10,  // 第一批次最多10个
                TaleForgeError::MaxFirstBatchNFTsReached
            );
            
            nft.mint_batch = 1;
            nft.mining_weight = 100;  // 初始批次权重

            // 如果达到10个，标记第一次铸造完成
            if story.nft_count == 9 {
                story.first_mint_completed = true;
            }
        } else {
            // 检查第二次铸造条件
            require!(
                story.second_mint_enabled,
                TaleForgeError::SecondMintNotEnabled
            );
            require!(
                story.nft_count < story.max_nfts,  // 不超过设定的最大数量
                TaleForgeError::MaxNFTsReached
            );
            
            nft.mint_batch = 2;
            nft.mining_weight = 50;  // 第二批次权重
        }

        // 设置 NFT 属性
        nft.story = story.key();
        nft.name = name;
        nft.description = description;
        nft.image_uri = image_uri;
        nft.nft_type = nft_type;
        // 使用最近的区块哈希生成随机稀有度
        nft.rarity = Rarity::random(&ctx.accounts.recent_blockhash.key().to_bytes());
        nft.owner = ctx.accounts.author.key();
        nft.created_at = Clock::get()?.unix_timestamp;
        nft.is_transferable = true;
        nft.is_listed = false;
        nft.list_time = 0;
        nft.list_price_sol = 0;
        nft.list_price_token = 0;
        nft.staked_earnings = 0;
        nft.earnings_start_time = Clock::get()?.unix_timestamp;

        story.nft_count += 1;
        
        emit!(NFTMinted {
            story: story.key(),
            nft: nft.key(),
            nft_type,
            rarity: nft.rarity.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn update_story_settings(
        ctx: Context<UpdateStorySettings>,
        min_words_for_nft: u64,    // 铸造 NFT 所需的最小字数
        max_nfts: u32,             // 最大可铸造数量
    ) -> Result<()> {
        let story = &mut ctx.accounts.story;
        
        // 检查参数合理性
        require!(min_words_for_nft > 0, TaleForgeError::InvalidWordCount);
        require!(max_nfts <= 100, TaleForgeError::InvalidNFTLimit);  // 最多100个NFT

        story.min_words_for_nft = min_words_for_nft;
        story.max_nfts = max_nfts;
        story.last_update_time = Clock::get()?.unix_timestamp;

        Ok(())
    }

    //购买NFT
    pub fn buy_nft(
        ctx: Context<TransferNFT>,
        use_token: bool  // true: 使用 TAFOR, false: 使用 SOL
    ) -> Result<()> {
        require!(!ctx.accounts.guard.is_entered, TaleForgeError::ReentrancyError);
        ctx.accounts.guard.is_entered = true;
        
        // 先获取所有不可变的值
        let nft_key = ctx.accounts.nft.key();
        let story_key = ctx.accounts.story.key();
        
        let nft = &mut ctx.accounts.nft;
        let story = &mut ctx.accounts.story;
        
        // 获取其他需要的值
        let previous_owner = nft.owner;
        let list_price = if use_token {
            nft.list_price_token
        } else {
            nft.list_price_sol
        };
        let platform_fee = list_price * 25 / 1000;  // 2.5% 平台费用
        let seller_amount = list_price - platform_fee;

        // 1. 验证 NFT 状态
        require!(nft.is_transferable, TaleForgeError::NFTNotTransferable);
        require!(nft.is_listed, TaleForgeError::NFTNotListed);
        require!(nft.owner == ctx.accounts.current_owner.key(), TaleForgeError::UnauthorizedOwner);

        if use_token {
            // 使用 TAFOR 支付
            require!(
                ctx.accounts.buyer_token.is_some() && 
                ctx.accounts.seller_token.is_some() && 
                ctx.accounts.fee_receiver_token.is_some(),
                TaleForgeError::TokenAccountsRequired
            );

            // 转账给卖家
            let seller_payment = tafortoken::TaforPayment {
                from: ctx.accounts.buyer_token.as_ref().unwrap().to_account_info(),
                to: ctx.accounts.seller_token.as_ref().unwrap().to_account_info(),
                authority: ctx.accounts.current_owner.clone(),
                token_program: ctx.accounts.token_program.clone(),
            };
            seller_payment.process_payment(seller_amount)?;

            // 转账平台费用
            let mut fee_payment = tafortoken::TaforPayment {
                from: ctx.accounts.buyer_token.as_ref().unwrap().to_account_info(),
                to: ctx.accounts.fee_receiver_token.as_ref().unwrap().to_account_info(),
                authority: ctx.accounts.current_owner.clone(),
                token_program: ctx.accounts.token_program.clone(),
            };
            fee_payment.process_payment(platform_fee)?;
        } else {
            // 使用 SOL 支付
            // 3. 转移 SOL
            // 3.1 转移给卖家
            let transfer_to_seller = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.new_owner.key(),
                &ctx.accounts.current_owner.key(),
                seller_amount,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_to_seller,
                &[
                    ctx.accounts.new_owner.to_account_info(),
                    ctx.accounts.current_owner.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // 4. 更新 NFT 状态
        // nft.previous_owners.push(previous_owner);
        nft.owner = ctx.accounts.new_owner.key();
        nft.is_listed = false;
        nft.list_price_sol = 0;
        nft.list_price_token = 0;

        // 5. 更新作品的 NFT 收益
        if use_token {
            story.total_nft_revenue_token += list_price;
        } else {
            story.total_nft_revenue_sol += list_price;
        }
        story.last_nft_revenue_update = Clock::get()?.unix_timestamp;

        // 6. 发出事件
        emit!(NFTSold {
            story: story_key,
            nft: nft_key,
            seller: previous_owner,
            buyer: ctx.accounts.new_owner.key(),
            price: list_price,
            platform_fee,
            use_token,
            timestamp: Clock::get()?.unix_timestamp,
        });

        ctx.accounts.guard.is_entered = false;
        Ok(())
    }

      // NFT 挂单卖出
      pub fn list_nft(
        ctx: Context<ListNFT>,
        price_sol: u64,
        price_token: u64
    ) -> Result<()> {
        // 先获取所有不可变的值
        let nft_key = ctx.accounts.nft.key();
        
        let nft = &mut ctx.accounts.nft;
        let story_key = nft.story;
        let owner = nft.owner;
        
        // 验证所有权和状态
        require!(nft.owner == ctx.accounts.owner.key(), TaleForgeError::UnauthorizedOwner);
        require!(nft.is_transferable, TaleForgeError::NFTNotTransferable);
        require!(!nft.is_listed, TaleForgeError::NFTAlreadyListed);
        require!(price_sol > 0 || price_token > 0, TaleForgeError::InvalidListPrice);

        // 更新 NFT 状态
        nft.is_listed = true;
        nft.list_price_sol = price_sol;
        nft.list_price_token = price_token;
        nft.list_time = Clock::get()?.unix_timestamp;

        // 发出事件
        emit!(NFTListed {
            story: story_key,
            nft: nft_key,
            owner,
            price_sol,
            price_token,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // 取消上架
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        // 先获取所有不可变的值
        let nft_key = ctx.accounts.nft.key();
        
        let nft = &mut ctx.accounts.nft;
        let story_key = nft.story;
        let owner = nft.owner;
        
        // 验证所有权和状态
        require!(nft.owner == ctx.accounts.owner.key(), TaleForgeError::UnauthorizedOwner);
        require!(nft.is_listed, TaleForgeError::NFTNotListed);

        // 更新 NFT 状态
        nft.is_listed = false;
        nft.list_price_sol = 0;
        nft.list_price_token = 0;

        // 发出事件
        emit!(NFTListingCanceled {
            story: story_key,
            nft: nft_key,
            owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }



    // ******** 4. 挖矿相关 ********

    #[account]
    pub struct MiningPool {
        pub start_time: i64,           // 8 bytes 挖矿开始时间
        pub last_reward_time: i64,     // 8 bytes 上次发放时间
        pub total_distributed: u64,     // 8 bytes 已发放总量
        pub current_epoch: u64,        // 8 bytes 当前减半周期
        pub total_mining_power: u64,   // 8 bytes 当前总算力
        pub total_amount: u64,         // 8 bytes 总量
        pub token_mint: Pubkey,        // 32 bytes 代币铸币账户
    }

    impl MiningPool {
        // 计算当前周期的奖励总量
        pub fn get_current_reward(&self) -> u64 {
            let initial_reward = INITIAL_WEEKLY_REWARD;
            initial_reward >> self.current_epoch // 每3年减半
        }

        // 更新减半周期
        // pub fn update_epoch(&mut self) -> Result<()> {
        //     let current_time = Clock::get()?.unix_timestamp;
        //     let elapsed_time = current_time - self.start_time;
        //     self.current_epoch = (elapsed_time / HALVING_PERIOD) as u64;
        //     Ok(())
        // }

        // // 计算每点算力的奖励
        // pub fn get_reward_per_power(&self) -> f64 {
        //     let weekly_reward = self.get_current_reward() as f64;
        //     if self.total_mining_power == 0 {
        //         0.0
        //     } else {
        //         weekly_reward / self.total_mining_power as f64
        //     }
        // }

    }

    //**前端操作方式。注意一定让前端按照下面方式调用
    /*
    每周挖矿奖励分配流程：
        第一步：调用 start_weekly_power_calculation 开始新的计算周期
        第二步：分批调用 calculate_story_power 更新每个作品的算力
        第三步：调用 finish_weekly_calculation 完成计算
        第四步：调用 distribute_mining_rewards 分发总奖励（分配给读者池、平台，剩余部分记录在 ActiveStories 中）
    奖励领取流程：
       第五步：作者调用 claim_story_reward 来领取自己作品的奖励
        - 作者获得 50% 的奖励直接发放
        - NFT 持有者的 50% 奖励根据批次权重分配，并根据稀有度决定是直接发放还是进入质押状态
     */

    // 添加 ActiveStories 结构体
    #[account]
    pub struct ActiveStories {
        pub authority: Pubkey,
        pub total_mining_power: u64,        // 总算力
        pub last_update_time: i64,          // 上次更新时间
        pub current_period: u64,            // 当前周期
        pub is_calculating: bool,           // 是否正在计算算力
        pub batch_size: u8,                 // 每批处理的作品数量（默认25）
        pub current_batch: u32,             // 当前处理的批次
        pub total_batches: u32,             // 总批次数
        pub is_batch_completed: bool,       // 当前批次是否完成
        pub reward_per_power: u64,          // 每点算力的奖励
        pub total_rewards: u64,             // 当前周期总奖励
        pub period_rewards: Vec<PeriodReward>,  // 每个周期的奖励记录
        pub last_distribution_time: i64,    // 上次分发奖励时间
    }

    // 添加周期奖励记录结构
    #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
    pub struct PeriodReward {
        pub period: u64,
        pub reward_per_power: u64,
        pub total_mining_power: u64,
        pub total_rewards: u64,
        pub timestamp: i64,
    }

    // 为 ActiveStories 添加方法
    impl ActiveStories {
        // 获取指定周期的每点算力奖励
        pub fn get_period_reward_per_power(&self, period: u64) -> Result<u64> {
            self.period_rewards
                .iter()
                .find(|r| r.period == period)
                .map(|r| r.reward_per_power)
                .ok_or(TaleForgeError::PeriodRewardNotFound.into())
        }

        // 获取指定周期的总奖励
        pub fn get_period_total_rewards(&self, period: u64) -> Result<u64> {
            self.period_rewards
                .iter()
                .find(|r| r.period == period)
                .map(|r| r.total_rewards)
                .ok_or(TaleForgeError::PeriodRewardNotFound.into())
        }

        // 添加新的周期奖励记录
        pub fn add_period_reward(&mut self, reward: PeriodReward) {
            self.period_rewards.push(reward);
            if self.period_rewards.len() > 10 {  // 只保留最近10个周期的记录
                self.period_rewards.remove(0);
            }
        }
    }

    // 添加新的 Context 结构体
    #[derive(Accounts)]
    pub struct StartWeeklyCalculation<'info> {
        #[account(
            mut,
            seeds = [b"active_stories"],
            bump
        )]
        pub active_stories: Account<'info, ActiveStories>,
        pub authority: Signer<'info>,
    }

    #[derive(Accounts)]
    pub struct CalculateStoryPower<'info> {
        #[account(
            mut,
            seeds = [b"active_stories"],
            bump
        )]
        pub active_stories: Account<'info, ActiveStories>,
        
        // 支持批量处理多个作品账户（最多25个）
        #[account(mut)]
        pub stories: Vec<Account<'info, Story>>,
        pub authority: Signer<'info>,
    }

    #[derive(Accounts)]
    pub struct FinishWeeklyCalculation<'info> {
        #[account(
            mut,
            seeds = [b"active_stories"],
            bump
        )]
        pub active_stories: Account<'info, ActiveStories>,
        pub authority: Signer<'info>,
    }

    // 在 tale_forge mod 中添加新指令
    // 开始每周算力计算,这类完成结构体中全局变量赋值
    pub fn start_weekly_power_calculation(ctx: Context<StartWeeklyCalculation>) -> Result<()> {
        let active_stories = &mut ctx.accounts.active_stories;
        let current_time = Clock::get()?.unix_timestamp;
        
        // 检查是否到了计算时间（一周）
        require!(
            current_time - active_stories.last_update_time >= 7 * 24 * 60 * 60,
            TaleForgeError::TooEarlyToCalculate
        );

        // 检查是否已在计算中
        require!(!active_stories.is_calculating, TaleForgeError::CalculationInProgress);

        // 开始新的计算周期
        active_stories.is_calculating = true;
        active_stories.total_mining_power = 0;  // 重置总算力
        active_stories.current_period += 1;
        active_stories.current_batch = 0;
        active_stories.batch_size = 25;  // 设置每批处理25个作品
        active_stories.total_batches = 0;  // 将在处理第一批时更新
        active_stories.is_batch_completed = false;
        active_stories.last_update_time = current_time;
        
        emit!(WeeklyCalculationStarted {
            period: active_stories.current_period,
            total_stories: 0,  // 将在处理第一批时更新
            total_batches: 0,
            timestamp: current_time,
        });
        
        Ok(())
    }

    // 计算单个作品的算力
    pub fn calculate_story_power(ctx: Context<CalculateStoryPower>) -> Result<()> {
        let active_stories = &mut ctx.accounts.active_stories;
        require!(active_stories.is_calculating, TaleForgeError::NotInCalculationPeriod);
        
        // 处理每个作品的算力
        for story in ctx.accounts.stories.iter_mut() {
            let old_power = story.mining_power;
            
            // 1. 基础算力计算 (调整权重)
            const WORD_COUNT_WEIGHT: u64 = 30;     // 字数权重30%
            const TIP_WEIGHT: u64 = 25;            // 打赏权重25%
            const LIKE_WEIGHT: u64 = 10;           // 点赞权重10%
            const COMMENT_WEIGHT: u64 = 15;        // 评论权重15%
            const NFT_REVENUE_WEIGHT: u64 = 20;    // NFT收益权重20%

            // 基础算力
            let base_power = (story.current_period_words / 1000) * WORD_COUNT_WEIGHT +
                            (story.current_period_likes * LIKE_WEIGHT) / 100 +
                            (story.current_period_comments * COMMENT_WEIGHT) / 50 +
                            ((story.current_period_tips_sol / LAMPORTS_PER_SOL + 
                              story.current_period_tips_token / 100_000) * TIP_WEIGHT) / 100;

            // NFT总收益算力 (基于累计收益)
            let nft_power = match story.total_nft_revenue_sol {
                0..=1_000_000_000 => 100,            // 基础算力 (0-1000 SOL)
                1_000_000_001..=5_000_000_000 => 200,  // 初级算力 (1000-5000 SOL)
                5_000_000_001..=10_000_000_000 => 400, // 中级算力 (5000-10000 SOL)
                10_000_000_001..=50_000_000_000 => 800,// 高级算力 (10000-50000 SOL)
                _ => 1600                             // 顶级算力 (50000+ SOL)
            };

            // 如果使用 TAFOR 支付，每 10w 代币增加 1 点权重
            let token_weight = story.total_nft_revenue_token / 100000;

            let total_base_power = base_power + ((nft_power + token_weight) * NFT_REVENUE_WEIGHT) / 100;

            // 2. 等级倍率 (更平滑的增长曲线)
            let level_multiplier = match total_base_power {
                0..=1000 => 1.0,     // 铜牌 (入门级)
                1001..=3000 => 1.5,  // 白银 (进阶级)
                3001..=6000 => 2.5,  // 黄金 (优秀级)
                6001..=10000 => 4.0, // 白金 (精英级)
                10001..=15000 => 8.0,// 钻石 (大神级)
                _ => 16.0,           // 传说 (现象级)
            };

            // 3. 爆发增益 (突出优秀表现)
            let burst_bonus = if story.is_trending() {  // 判断是否处于爆发期
                total_base_power * 2  // 爆发期双倍算力
            } else {
                0
            };

            // 4. 最终算力计算
            let adjusted_power = (total_base_power as f64 * level_multiplier) as u64;
            story.mining_power = adjusted_power + burst_bonus;
                
            // 更新总算力
            active_stories.total_mining_power = active_stories.total_mining_power
                .saturating_add(story.mining_power);
                
            // 重置周期数据
            story.current_period_words = 0;
            story.current_period_likes = 0;
            story.current_period_comments = 0;
            story.current_period_tips_sol = 0;
            story.current_period_tips_token = 0;
            story.last_mining_power_update = Clock::get()?.unix_timestamp;
            
            emit!(StoryMiningPowerUpdated {
                story: story.key(),
                old_power,
                new_power: story.mining_power,
                batch: active_stories.current_batch,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }
        
        // 更新批次状态
        active_stories.current_batch = active_stories.current_batch.saturating_add(1);
        active_stories.is_batch_completed = true;
        
        emit!(BatchCompleted {
            batch: active_stories.current_batch.saturating_sub(1),
            stories_processed: ctx.accounts.stories.len() as u32,
            is_final_batch: active_stories.is_batch_completed,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    // 完成每周算力计算
    pub fn finish_weekly_calculation(ctx: Context<FinishWeeklyCalculation>) -> Result<()> {
        let active_stories = &mut ctx.accounts.active_stories;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(active_stories.is_calculating, TaleForgeError::NotInCalculationPeriod);
        require!(active_stories.is_batch_completed, TaleForgeError::BatchNotCompleted);
        
        // 计算每点算力的奖励
        if active_stories.total_mining_power > 0 {
            active_stories.reward_per_power = active_stories.total_rewards
                .checked_div(active_stories.total_mining_power)
                .ok_or(TaleForgeError::InvalidMiningPower)?;
        }
        
        // 添加周期奖励记录
        let period_reward = PeriodReward {
            period: active_stories.current_period,
            reward_per_power: active_stories.reward_per_power,
            total_mining_power: active_stories.total_mining_power,
            total_rewards: active_stories.total_rewards,
            timestamp: current_time,
        };
        active_stories.add_period_reward(period_reward);
        
        // 完成计算
        active_stories.is_calculating = false;
        active_stories.is_batch_completed = false;
        active_stories.last_update_time = current_time;
        
        emit!(WeeklyCalculationCompleted {
            period: active_stories.current_period,
            total_mining_power: active_stories.total_mining_power,
            reward_per_power: active_stories.reward_per_power,
            total_rewards: active_stories.total_rewards,
            timestamp: current_time,
        });
        
        Ok(())
    }


    // 添加挖矿奖励分配指令
    pub fn distribute_mining_rewards(ctx: Context<DistributeMiningRewards>) -> Result<()> {
        let active_stories = &mut ctx.accounts.active_stories;
        let story = &mut ctx.accounts.story;
        let current_time = Clock::get()?.unix_timestamp;
        
        // 检查是否有未领取的奖励
        require!(!story.unclaimed_periods.is_empty(), TaleForgeError::InvalidRewardDistribution);
        
        // 计算总奖励
        let mut total_reward = 0;
        for period in story.unclaimed_periods.iter() {
            let period_reward_per_power = active_stories.get_period_reward_per_power(*period)?;
            total_reward = total_reward.saturating_add(
                story.mining_power.saturating_mul(period_reward_per_power)
            );
        }
        
        // 分配奖励
        // 5% 给读者抽奖池
        let reader_pool_reward = total_reward.saturating_mul(5).checked_div(100)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        // 10% 给平台
        let platform_reward = total_reward.saturating_mul(10).checked_div(100)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        // 剩余 85% 平分给作者和 NFT 持有者
        let remaining_reward = total_reward
            .saturating_sub(reader_pool_reward)
            .saturating_sub(platform_reward);
        let author_reward = remaining_reward.saturating_mul(50).checked_div(100)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        let nft_reward = remaining_reward.saturating_mul(50).checked_div(100)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        
        // 转账奖励
        // 读者抽奖池奖励
        **ctx.accounts.reader_pool.try_borrow_mut_lamports()? = ctx.accounts.reader_pool
            .lamports()
            .checked_add(reader_pool_reward)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        
        // 平台奖励
        **ctx.accounts.platform.try_borrow_mut_lamports()? = ctx.accounts.platform
            .lamports()
            .checked_add(platform_reward)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        
        // 作者奖励
        **ctx.accounts.author.try_borrow_mut_lamports()? = ctx.accounts.author
            .lamports()
            .checked_add(author_reward)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        
        // NFT 奖励进入质押池
        story.staked_earnings_sol = story.staked_earnings_sol
            .checked_add(nft_reward)
            .ok_or(TaleForgeError::InvalidRewardDistribution)?;
        
        // 清空未领取周期
        story.unclaimed_periods.clear();
        story.last_claimed_period = active_stories.current_period;
        
        emit!(RewardsDistributed {
            story: story.key(),
            author: ctx.accounts.author.key(),
            period: active_stories.current_period,
            mining_power: story.mining_power,
            total_reward,
            reader_pool_reward,
            platform_reward,
            author_reward,
            nft_reward,
            timestamp: current_time,
        });
        
        Ok(())
    }

    // 4. 添加新的指令：作品领取奖励
    #[derive(Accounts)]
    pub struct ClaimStoryReward<'info> {
        #[account(
            mut,
            constraint = story.author == author.key() @ TaleForgeError::UnauthorizedAuthor
        )]
        pub story: Account<'info, Story>,
        #[account(mut)]
        pub author: Signer<'info>,  // 作者必须签名
        #[account(mut)]
        pub author_token: Account<'info, TokenAccount>,
        #[account(mut)]
        pub mining_pool_token: Account<'info, TokenAccount>,
        #[account(
            mut,
            seeds = [b"active_stories"],
            bump
        )]
        pub active_stories: Account<'info, ActiveStories>,
        #[account(mut)]
        pub nfts: Vec<Account<'info, NovelNFT>>,
        pub authority: Signer<'info>,
        pub token_program: Program<'info, Token>,
    }

    pub fn claim_story_reward(ctx: Context<ClaimStoryReward>) -> Result<()> {
        let story = &mut ctx.accounts.story;
        let active_stories = &ctx.accounts.active_stories;
        
        // 检查是否有未领取的奖励
        require!(
            story.last_claimed_period < active_stories.current_period,
            TaleForgeError::NoUnclaimedRewards
        );

        // 计算所有未领取周期的总奖励
        let mut total_reward = 0u64;
        
        // 从上次领取的周期开始，到当前周期的前一个周期
        for period in (story.last_claimed_period + 1)..active_stories.current_period {
            // 获取该周期的每点算力奖励
            let period_reward_per_power = active_stories.get_period_reward_per_power(period)?;
            
            // 计算该周期的奖励
            let period_reward = story.mining_power
                .checked_mul(period_reward_per_power)
                .ok_or(TaleForgeError::InvalidMiningPower)?;
            
            total_reward = total_reward
                .checked_add(period_reward)
                .ok_or(TaleForgeError::InvalidMiningPower)?;
        }
        
        // 分配总奖励：作者50%，NFT持有者50%
        let author_reward = total_reward * 50 / 100;
        let nft_holders_reward = total_reward * 50 / 100;
        
        // 转账给作者
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.mining_pool_token.to_account_info(),
                    to: ctx.accounts.author_token.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            author_reward,
        )?;
        
        // 计算 NFT 总权重
        let mut total_weight = 0u64;
        for nft in &ctx.accounts.nfts {
            let weight = match nft.mint_batch {
                1 => 100, // 第一批次权重100
                2 => 50,  // 第二批次权重50
                _ => 0,
            };
            total_weight += weight;
        }
        
        // 分配 NFT 持有者奖励
        if total_weight > 0 {
            for nft in &mut ctx.accounts.nfts {
                let nft_weight = match nft.mint_batch {
                    1 => 100,
                    2 => 50,
                    _ => 0,
                };
                
                let nft_reward = nft_holders_reward
                    .checked_mul(nft_weight)
                    .and_then(|r| r.checked_div(total_weight))
                    .ok_or(TaleForgeError::InvalidMiningPower)?;
                
                // 根据稀有度决定质押时间
                match nft.rarity {
                    Rarity::Legendary => {
                        // 传说级 NFT 直接发放奖励
                        token::transfer(
                            CpiContext::new(
                                ctx.accounts.token_program.to_account_info(),
                                Transfer {
                                    from: ctx.accounts.mining_pool_token.to_account_info(),
                                    to: ctx.accounts.author_token.to_account_info(), // 这里应该改为 NFT 持有者的代币账户
                                    authority: ctx.accounts.authority.to_account_info(),
                                },
                            ),
                            nft_reward,
                        )?;
                    },
                    _ => {
                        // 其他稀有度进入质押状态，质押时间由稀有度决定
                        nft.staked_earnings = nft.staked_earnings
                            .checked_add(nft_reward)
                            .ok_or(TaleForgeError::InvalidMiningPower)?;
                        
                        // 如果是第一次质押，记录开始时间
                        if nft.staked_earnings == nft_reward {
                            nft.earnings_start_time = Clock::get()?.unix_timestamp;
                        }
                    }
                }
                
                emit!(NFTRewardStaked {
                    nft: nft.key(),
                    story: story.key(),
                    amount: nft_reward,
                    rarity: nft.rarity.clone(),
                    batch: nft.mint_batch,
                    weight: nft_weight,
                    timestamp: Clock::get()?.unix_timestamp,
                });
            }
        }
        
        // 更新作品的领取状态
        story.last_claimed_period = active_stories.current_period - 1;  // 更新到当前周期的前一个周期
        
        emit!(StoryRewardClaimed {
            story: story.key(),
            author_reward,
            nft_holders_reward,
            total_nft_weight: total_weight,
            nft_count: ctx.accounts.nfts.len() as u32,
            claimed_periods: (story.last_claimed_period + 1..active_stories.current_period).count() as u32,
            total_reward,
            period: active_stories.current_period,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    
    



    // ******** 5. 读者奖励相关 ********
    // 添加奖励池结构
    #[account]
    pub struct ReaderRewardPool {
        pub total_amount: u64,         // 8 bytes 总量
        pub last_lottery_time: i64,   // 8 bytes 上次抽奖时间
        pub active_readers: u32,      // 8 bytes 活跃读者数量
        pub token_mint: Pubkey,        // 32 bytes 代币铸币账户
        pub accumulated_rewards: u64,   // 8 bytes 累积未分配奖励
        pub last_distribution: i64,    // 8 bytes 上次分配时间
    }

    impl ReaderRewardPool {
        pub fn add_rewards(&mut self, amount: u64) -> Result<()> {
            self.accumulated_rewards += amount;
            self.total_amount += amount;
            Ok(())
        }

        pub fn distribute_rewards(&mut self, winners: Vec<Pubkey>) -> Result<()> {
            require!(self.accumulated_rewards > 0, TaleForgeError::EmptyRewardPool);
            require!(!winners.is_empty(), TaleForgeError::NoEligibleReaders);

            let reward_per_winner = self.accumulated_rewards / winners.len() as u64;
            self.accumulated_rewards = 0;
            self.last_distribution = Clock::get()?.unix_timestamp;
            self.total_amount -= reward_per_winner * winners.len() as u64;
            Ok(())
        }
    }

    
    // 添加读者签到指令
    pub fn reader_check_in(ctx: Context<ReaderCheckIn>) -> Result<()> {
        let activity = &mut ctx.accounts.reader_activity;
        let current_time = Clock::get()?.unix_timestamp;
        let check_in_index = activity.check_in_count as usize;  // 先获取索引值

        // 检查是否已经今日签到
        require!(
            !is_same_day(activity.last_check_in, current_time),
            TaleForgeError::AlreadyCheckedIn
        );

        // 更新签到记录
        if activity.check_in_count < 30 {
            activity.daily_check_ins[check_in_index] = current_time;  // 使用预先获取的索引
            activity.check_in_count += 1;
        } else {
            // 如果已满，移除最旧的记录
            for i in 1..30 {
                activity.daily_check_ins[i-1] = activity.daily_check_ins[i];
            }
            activity.daily_check_ins[29] = current_time;
        }
        
        activity.last_check_in = current_time;
        activity.monthly_active_days += 1;
        activity.lottery_weight = calculate_reader_weight(activity);

        Ok(())
    }

    // 月度抽奖指令
    pub fn monthly_lottery(ctx: Context<MonthlyLottery>) -> Result<()> {
        // 先获取所有需要的值
        let last_lottery_time = ctx.accounts.reader_reward_pool.last_lottery_time;
        let total_amount = ctx.accounts.reader_reward_pool.total_amount;
        let active_readers = ctx.accounts.reader_reward_pool.active_readers;
        
        let current_time = Clock::get()?.unix_timestamp;  // 获取当前时间
        // 确保一个月时间已到
        require!(
            current_time - last_lottery_time >= 30 * 24 * 60 * 60,  // 解引用
            TaleForgeError::TooEarlyForLottery
        );
        require!(
            total_amount > 0,  // 解引用后比较
            TaleForgeError::EmptyRewardPool
        );
        require!(
            active_readers > 0,  // 解引用后比较
            TaleForgeError::NoActiveReaders
        );

        // 2. 获取合格读者
        let eligible_readers = get_eligible_readers(
            &ctx.accounts.reader_activities,
            current_time
        )?;

        // 3. 处理极端情况
        match eligible_readers.len() {
            0 => {
                // 无合格读者，奖池累积到下月
                emit!(LotterySkipped {
                    reason: "No eligible readers".to_string(),
                    accumulated_amount: total_amount,  // 解引用后使用
                    timestamp: current_time,
                });
                Ok(())
            },
            1..=10 => {
                // 先获取所有需要的值
                let reader_count = eligible_readers.len();
                
                // 保留20%到下月奖池
                let reserved_amount = total_amount * 20 / 100;
                let distributable_amount = total_amount - reserved_amount;
                
                // 每个读者平均分配
                let reward_per_reader = distributable_amount / reader_count as u64;

                // 先更新状态
                ctx.accounts.reader_reward_pool.last_lottery_time = current_time;
                ctx.accounts.reader_reward_pool.total_amount = reserved_amount;

                // 分发奖励给中奖者
                for reader in &eligible_readers {
                    token::transfer(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts.reader_reward_pool.to_account_info(),
                                to: ctx.accounts.winner_token.to_account_info(),
                                authority: ctx.accounts.authority.to_account_info(),
                            }
                        ),
                        reward_per_reader
                    )?;
                }

                emit!(MinimalLotteryCompleted {
                    winner_count: reader_count as u32,
                    distributed_amount: distributable_amount,
                    reserved_amount,
                    timestamp: current_time,
                });

                Ok(())
            },
            _ => {
                // 正常抽奖流程
                // 1. 计算基础获奖人数和特等奖人数
                let base_winner_count = (active_readers * LOTTERY_WINNER_PERCENTAGE) / 100;
                
                // 2. 分配奖池
                let total_pool = total_amount;
                let extra_prize_pool = total_pool * 20 / 100;  // 20%用于特等奖
                let base_prize_pool = total_pool - extra_prize_pool;

                // 3. 选择基础获奖者
                let base_winners = select_winners(
                    &ctx,
                    base_winner_count,
                    current_time
                )?;

                // 4. 选择特等奖获奖者（从未中基础奖的读者中选择）
                let remaining_readers: Vec<_> = eligible_readers
                    .iter()
                    .filter(|&pubkey| !base_winners.contains(pubkey))
                    .cloned()
                    .collect();

                let extra_winners = if !remaining_readers.is_empty() {
                    select_winners(
                        &ctx,
                        LOTTERY_EXTRA_PRIZE_COUNT,
                        current_time
                    )?
                } else {
                    vec![]
                };

                // 5. 计算每人奖励金额
                let base_reward = if !base_winners.is_empty() {
                    base_prize_pool / base_winners.len() as u64
                } else {
                    0
                };

                let extra_reward = if !extra_winners.is_empty() {
                    extra_prize_pool / extra_winners.len() as u64
                } else {
                    0
                };

                // 6. 分发基础奖励
                for winner in base_winners.iter() {
                    token::transfer(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts.reader_reward_pool.to_account_info(),
                                to: ctx.accounts.winner_token.to_account_info(),
                                authority: ctx.accounts.authority.to_account_info(),
                            }
                        ),
                        base_reward
                    )?;
                }

                // 7. 分发特等奖
                for winner in extra_winners.iter() {
                    token::transfer(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts.reader_reward_pool.to_account_info(),
                                to: ctx.accounts.winner_token.to_account_info(),
                                authority: ctx.accounts.authority.to_account_info(),
                            }
                        ),
                        extra_reward
                    )?;
                }

                // 8. 更新奖池状态
                ctx.accounts.reader_reward_pool.last_lottery_time = current_time;
                ctx.accounts.reader_reward_pool.total_amount = 0;

                // 9. 发出事件
                emit!(MonthlyLotteryCompleted {
                    base_winners: base_winners.len() as u32,
                    extra_winners: extra_winners.len() as u8,
                    total_reward: total_pool,
                    timestamp: current_time,
                });

                Ok(())
            }
        }

        // Ok(())
    }

    // 抽奖事件
    #[event]
    pub struct MonthlyLotteryCompleted {
        pub base_winners: u32,
        pub extra_winners: u8,
        pub total_reward: u64,
        pub timestamp: i64,
    }

    pub fn register_author(ctx: Context<RegisterAuthor>, pen_name: String) -> Result<()> {
        // 验证笔名记录是否已存在
        let pen_name_record = &mut ctx.accounts.pen_name_record;
        require!(
            pen_name_record.owner == Pubkey::default() && 
            pen_name_record.pen_name.is_empty(),
            TaleForgeError::PenNameAlreadyExists
        );
        
        let author = &mut ctx.accounts.author;
        let current_time = Clock::get()?.unix_timestamp;

        // 初始化笔名记录
        pen_name_record.pen_name = pen_name.clone();
        pen_name_record.owner = ctx.accounts.authority.key();
        pen_name_record.created_at = current_time;

        // 初始化作者信息
        author.address = ctx.accounts.authority.key();
        author.pen_name = pen_name;
        author.story_count = 0;
        author.total_word_count = 0;
        author.total_earnings_sol = 0;
        author.total_earnings_token = 0;
        author.total_mining_rewards = 0;
        author.stories = Vec::new();
        author.created_at = current_time;
        author.last_update = current_time;

        Ok(())
    }

    // 更新作者统计信息。主要用于测试。注意这里虽然是测试用，但是实际使用时，各个参数更行的点还是要参考这里进行实现
    pub fn update_author_stats(
        ctx: Context<UpdateAuthorStats>,
        story_count_delta: u64,
        word_count_delta: u64,
        earnings_token_delta: u64,
        earnings_sol_delta: u64
    ) -> Result<()> {
        let author = &mut ctx.accounts.author;
        let current_time = Clock::get()?.unix_timestamp;

        // 检查作品数上限（注意这个需要修改到创建作品时，也就是创建作品时要实时跟新笔名下的作品数）
        let new_story_count = author.story_count.checked_add(story_count_delta as u32)
            .ok_or(TaleForgeError::InvalidAuthorStats)?;
        require!(new_story_count <= 50, TaleForgeError::MaxStoriesExceeded);
        author.story_count = new_story_count;

        author.total_word_count = author.total_word_count.checked_add(word_count_delta)
            .ok_or(TaleForgeError::InvalidAuthorStats)?;
        author.total_earnings_token = author.total_earnings_token.checked_add(earnings_token_delta)
            .ok_or(TaleForgeError::InvalidAuthorStats)?;
        author.total_earnings_sol = author.total_earnings_sol.checked_add(earnings_sol_delta)
            .ok_or(TaleForgeError::InvalidAuthorStats)?;
        author.last_update = current_time;

        Ok(())
    }

     // 更新笔名
     pub fn update_pen_name(
        ctx: Context<UpdatePenName>,
        new_pen_name: String
    ) -> Result<()> {
        let author = &mut ctx.accounts.author;
        let current_time = Clock::get()?.unix_timestamp;
        let old_pen_name = author.pen_name.clone();

        // 验证新笔名记录未被使用
        let new_pen_name_record = &mut ctx.accounts.new_pen_name_record;
        require!(
            new_pen_name_record.owner == Pubkey::default() && 
            new_pen_name_record.pen_name.is_empty(),
            TaleForgeError::PenNameAlreadyExists
        );

        // 更新笔名记录
        new_pen_name_record.pen_name = new_pen_name.clone();
        new_pen_name_record.owner = ctx.accounts.authority.key();
        new_pen_name_record.created_at = current_time;

        // 更新作者信息
        author.pen_name = new_pen_name.clone();
        author.last_update = current_time;

        // 发出笔名更新事件
        emit!(PenNameUpdated {
            author: author.key(),
            old_pen_name,
            new_pen_name,
            timestamp: current_time,
        });

        Ok(())
    }

    // 释放NFT挖矿收益
    pub fn release_nft_earnings(ctx: Context<ReleaseNFTEarnings>) -> Result<()> {
        let nft = &mut ctx.accounts.nft;
        let current_time = Clock::get()?.unix_timestamp;
        let hold_time = current_time - nft.earnings_start_time;

        // 检查是否满足持有时间要求
        let required_time = nft.rarity.get_stake_requirement();
        require!(
            hold_time >= required_time || matches!(nft.rarity, Rarity::Legendary),
            TaleForgeError::StakePeriodNotMet
        );

        // 检查是否有质押收益
        let amount = nft.staked_earnings;
        require!(amount > 0, TaleForgeError::NoStakedEarnings);

        // 清零质押金额
        nft.staked_earnings = 0;

        // 从挖矿池直接转移代币到持有者账户
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.mining_pool.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(NFTEarningsReleased {
            nft: nft.key(),
            owner: ctx.accounts.owner.key(),
            amount,
            timestamp: current_time,
        });

        Ok(())
}

#[derive(Accounts)]
    pub struct ReleaseNFTEarnings<'info> {
    #[account(
            mut,
            constraint = nft.owner == owner.key() @ TaleForgeError::UnauthorizedOwner
        )]
        pub nft: Account<'info, NovelNFT>,
    #[account(mut)]
        pub mining_pool: Account<'info, MiningPool>,  // 添加挖矿池账户
        #[account(mut)]
        pub owner_token: Account<'info, TokenAccount>,
        #[account(mut)]
        pub owner: Signer<'info>,
        pub authority: Signer<'info>,  // 添加权限账户
        pub token_program: Program<'info, Token>,
    }

    // // 将NFT持有者的收益转移到对应的NFT代币账户
    // impl<'info> ReleaseNFTEarnings<'info> {
    //     pub fn into_holder_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    //         CpiContext::new(
    //             self.token_program.to_account_info(),
    //             Transfer {
    //                 from: self.owner_token.to_account_info(),
    //                 to: self.nft.to_account_info(),
    //                 authority: self.owner.to_account_info(),
    //             },
    //         )
    //     }
    // }

    #[event]
    pub struct NFTEarningsReleased {
        pub nft: Pubkey,
        pub owner: Pubkey,
        pub amount: u64,
        pub timestamp: i64,
    }
}


// 根据权重选择获奖者
fn select_winners<'a>(
    ctx: &'a Context<MonthlyLottery>,
    winner_count: u32,
    current_time: i64
) -> Result<Vec<Pubkey>> {
    let reader_activities = &ctx.accounts.reader_activities;
    
    // 过滤合格读者 - 只修改访问方式
    let eligible_readers = if reader_activities.monthly_active_days >= MIN_ACTIVE_DAYS_FOR_LOTTERY {
        vec![reader_activities]
    } else {
        vec![]
    };
    
    require!(
        !eligible_readers.is_empty(),
        TaleForgeError::NoEligibleReaders
    );

    // 计算总权重
    let total_weight: u32 = eligible_readers
        .iter()
        .map(|activity| calculate_reader_weight(activity))
        .sum();

    // 选择获奖者
    let mut winners = Vec::new();
    let mut used_indices = Vec::new();

    // 使用时间戳和其他参数作为随机种子
    let seed = [
        current_time.to_le_bytes().as_ref(),
        total_weight.to_le_bytes().as_ref(),
        winner_count.to_le_bytes().as_ref()
    ].concat();

    while winners.len() < winner_count as usize && winners.len() < eligible_readers.len() {
        let random_weight = generate_pseudo_random(&seed, total_weight);
        let mut current_weight = 0;

        for (index, reader) in eligible_readers.iter().enumerate() {
            if used_indices.contains(&index) {
                continue;
            }
            current_weight += calculate_reader_weight(reader);
            if current_weight >= random_weight {
                winners.push(reader.reader);
                used_indices.push(index);
                break;
            }
        }
    }

    Ok(winners)
}

// 获取合格读者
fn get_eligible_readers(
    reader_activities: &Account<'_, ReaderActivity>,
    current_time: i64
) -> Result<Vec<Pubkey>> {
    let month_ago = current_time - 30 * 24 * 60 * 60;
    
    // 如果当前读者符合条件，返回其 Pubkey
    if reader_activities.monthly_active_days >= MIN_ACTIVE_DAYS_FOR_LOTTERY && 
        reader_activities.last_check_in > month_ago &&
        (reader_activities.comment_count > 0 || reader_activities.like_count > 0) {
        Ok(vec![reader_activities.reader])
    } else {
        Ok(vec![])
    }
}

// 使用简单的随机数生成方式
fn generate_pseudo_random(seed: &[u8], max: u32) -> u32 {
    let clock = Clock::get().unwrap();
    let timestamp = clock.unix_timestamp;
    
    // 简单的混合种子和时间戳
    let mut result = timestamp as u32;
    for &byte in seed {
        result = result.wrapping_mul(31).wrapping_add(byte as u32);
    }
    result % max
}

fn get_consecutive_days(activity: &ReaderActivity) -> u32 {
    let mut consecutive_days = 0;
    let mut last_day = 0;

    // 按时间排序
    let mut check_ins = activity.daily_check_ins.clone();
    check_ins.sort_unstable();

    for &timestamp in check_ins.iter() {
        let current_day = timestamp / (24 * 60 * 60);
        if last_day == 0 || current_day == last_day + 1 {
            consecutive_days += 1;
        } else if current_day != last_day {
            consecutive_days = 1;
        }
        last_day = current_day;
    }

    consecutive_days
}

fn calculate_reader_weight(activity: &ReaderActivity) -> u32 {
    let base_weight = 100;  // 基础权重
    let daily_bonus = activity.monthly_active_days as u32 * 20;  // 每日活跃+20分
    let consecutive_bonus = get_consecutive_days(activity) * 50;  // 连续签到+50分
    let interaction_bonus = activity.comment_count * 10 +         // 评论+10分
                          activity.like_count * 5;                // 点赞+5分
    
    base_weight + daily_bonus + consecutive_bonus + interaction_bonus
}

fn is_same_day(timestamp1: i64, timestamp2: i64) -> bool {
    const DAY_SECONDS: i64 = 24 * 60 * 60;
    timestamp1 / DAY_SECONDS == timestamp2 / DAY_SECONDS
}



//********6、各个数据结构体********
#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 +  // discriminator
               8 +  // start_time
               8 +  // last_reward_time
               8 +  // total_distributed
               8 +  // current_epoch
               8 +  // total_mining_power
               8 +  // total_amount
               32,  // token_mint
        seeds = [b"mining_pool"],
        bump
    )]
    pub mining_pool: Account<'info, MiningPool>,

    /// CHECK: Token account is initialized in the instruction
    #[account(mut)]
    pub mining_pool_token: AccountInfo<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 +  // discriminator
               8 +  // total_amount
               8 +  // last_lottery_time
               4 +  // active_readers (u32)
               32 + // token_mint
               8 +  // accumulated_rewards
               8,   // last_distribution
        seeds = [b"reader_reward_pool"],
        bump
    )]
    pub reader_reward_pool: Account<'info, ReaderRewardPool>,
    
    pub system_program: Program<'info, System>,//系统程序
    pub token_program: Program<'info, Token>,//代币程序
    /// CHECK: This is safe because we only read from it
    pub rent: AccountInfo<'info>,//租金
}

#[derive(Accounts)]
#[instruction(pen_name: String)]
pub struct RegisterAuthor<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 +  // discriminator
               32 +  // address (Pubkey)
               50 +  // pen_name (String)
               4 +  // story_count (u32)
               8 +  // total_word_count (u64)
               8 +  // total_earnings_sol (u64)
               8 +  // total_earnings_token (u64)
               8 +  // total_mining_rewards (u64)
               4 + 32 * 50 + // stories (Vec<Pubkey>) - 4 bytes for length + space for 50 stories
               8 +  // created_at (i64)
               8,   // last_update (i64)
        seeds = [b"author", authority.key().as_ref()],
        bump
    )]
    pub author: Account<'info, Author>,//作者
    
    #[account(
        init,
        payer = authority,
        space = 8 + // discriminator
               50 + // pen_name (String)
               32 + // owner (Pubkey)
               8,   // created_at (i64)
        seeds = [b"pen_name", pen_name.as_bytes()],
        bump,
        constraint = (1..=50).contains(&pen_name.len()) @ TaleForgeError::InvalidPenNameLength
    )]
    pub pen_name_record: Account<'info, PenNameRecord>,
    
    #[account(mut)]
    pub authority: Signer<'info>,//作者
    
    pub system_program: Program<'info, System>,
}

// 添加UpdatePenName结构体
#[derive(Accounts)]
#[instruction(new_pen_name: String)]
pub struct UpdatePenName<'info> {
    #[account(
        mut,
        constraint = author.address == authority.key() @ TaleForgeError::InvalidAuthor
    )]
    pub author: Account<'info, Author>,
    
    #[account(
        mut,
        close = authority,
        seeds = [b"pen_name", old_pen_name_record.pen_name.as_bytes()],
        bump,
        constraint = old_pen_name_record.owner == authority.key() @ TaleForgeError::InvalidAuthor
    )]
    pub old_pen_name_record: Account<'info, PenNameRecord>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 4 + 50 + 32 + 8, // discriminator + pen_name length + max pen_name size + pubkey + timestamp
        seeds = [b"pen_name", new_pen_name.as_bytes()],
        bump,
        constraint = (1..=50).contains(&new_pen_name.len()) @ TaleForgeError::InvalidPenNameLength
    )]
    pub new_pen_name_record: Account<'info, PenNameRecord>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// 添加UpdateAuthorStats结构体
#[derive(Accounts)]
pub struct UpdateAuthorStats<'info> {
    #[account(
        mut,
        constraint = author.address == authority.key() @ TaleForgeError::InvalidAuthor
    )]
    pub author: Account<'info, Author>,
    pub authority: Signer<'info>,
}


// 添加作者账户结构
#[account]
pub struct Author {
    pub address: Pubkey,           // 作者钱包地址
    pub pen_name: String,          // 作者笔名
    pub story_count: u32,          // 作品数量
    pub total_word_count: u64,     // 总字数
    pub total_earnings_sol: u64,   // SOL总收益
    pub total_earnings_token: u64, // TAFOR总收益
    pub total_mining_rewards: u64, // 总挖矿奖励
    pub stories: Vec<Pubkey>,      // 作品列表
    pub created_at: i64,           // 创建时间
    pub last_update: i64,          // 最后更新时间
}



// 作品结构体
#[account]
pub struct Story {
    pub title: String,         // 标题
    pub description: String,   // 简介    //100字以内 ，也可以考虑用ipfs
    pub author: Pubkey,        // 作者地址
    pub pen_name: String,      // 笔名
    pub cover_cid: String,     // 封面 IPFS CID
    pub content_cid: String,   // 内容 IPFS CID
    pub chapter_count: u32,    // 章节数
    pub is_completed: bool,    // 是否完结
    pub created_at: i64,       // 创建时间
    pub updated_at: i64,       // 更新时间   //这个可以不要
    pub nft_count: u32,        // 关联的 NFT 数量
    pub like_count: u64,       // 点赞数
    pub comment_count: u64,    // 评论数
    pub word_count: u64,       // 总字数
    pub weekly_word_count: u64,    // 本周字数        
    pub last_word_reset: i64,      // 上次字数重置时间
    pub avg_rating: u8,        // 平均评分 (1-5)
    pub rating_count: u32,     // 评分人数
    pub mining_power: u64,     // 挖矿算力（基于点赞、打赏、评论、周字数）
    pub nft_minting_enabled: bool,    // 是否允许铸造NFT
    pub max_nfts: u32,               // 最多NFT数量
    pub first_mint_completed: bool,   // 是否完成第一次铸造
    pub second_mint_enabled: bool,    // 是否允许第二次铸造
    pub target_word_count: u64,      // 目标总字数
    pub total_nft_revenue_sol: u64,     // NFT 总收益 (SOL)
    pub total_nft_revenue_token: u64,   // NFT 总收益 (TAFOR)
    pub total_tip_revenue_sol: u64,     // 打赏总收益 (SOL)
    pub total_tip_revenue_token: u64,   // 打赏总收益 (TAFOR)
    pub last_nft_revenue_update: i64,   // 最后 NFT 收益更新时间
    pub last_tip_update: i64,           // 最后打赏更新时间
    pub staked_earnings_sol: u64,    // SOL质押金额
    pub staked_earnings_token: u64,  // TAFOR质押金额
    pub is_abandoned: bool,         // 是否太监
    pub last_update_time: i64,      // 最后更新时间
    pub min_words_for_nft: u64,     // 铸造 NFT 所需的最小字数
    pub unclaimed_mining_reward: u64, // 未领取的挖矿奖励
    pub last_claimed_period: u64,     // 最后一次领取的周期
    pub unclaimed_periods: Vec<u64>,  // 未领取奖励的周期列表
    pub last_mining_power_update: i64, // 最后一次算力更新时间
    pub current_period_likes: u64,    // 当前周期获得的点赞数
    pub current_period_comments: u64, // 当前周期获得的评论数
    pub current_period_tips_sol: u64, // 当前周期获得的SOL打赏
    pub current_period_tips_token: u64, // 当前周期获得的TAFOR打赏
    pub current_period_words: u64,    // 当前周期新增字数
    pub is_active: bool,             // 是否处于活跃状态
}

impl Story {
    pub fn validate_title(title: &str) -> Result<()> {
        // 标题长度限制
        require!(
            !title.is_empty() && title.len() <= 100,
            TaleForgeError::InvalidTitleLength
        );
        Ok(())
    }

    pub fn validate_description(description: &str) -> Result<()> {
        // 简介长度限制
       require!(
            (1..=1000).contains(&description.len()),
            TaleForgeError::InvalidDescriptionLength
        );
        Ok(())
    }

    pub fn validate_cid(cid: &str) -> Result<()> {
        // 封面和内容cid格式限制
        require!(
            cid.starts_with("Qm") || cid.starts_with("bafy"),
            TaleForgeError::InvalidCIDFormat
        );
        Ok(())
    }

    // 计算挖矿算力
    // pub fn update_mining_power(&mut self) -> Result<()> {
    //     let current_time = Clock::get()?.unix_timestamp;
    //     const WEEK_IN_SECONDS: i64 = 7 * 24 * 60 * 60;

    //     // 检查是否需要重置周字数
    //     if current_time - self.last_word_reset >= WEEK_IN_SECONDS {
    //         self.weekly_word_count = 0;
    //         self.last_word_reset = current_time;
    //     }

    //     // 1. 基础算力计算 (调整权重)
    //     const WORD_COUNT_WEIGHT: u64 = 30;     // 字数权重降至30%
    //     const TIP_WEIGHT: u64 = 25;            // 打赏权重降至25%
    //     const LIKE_WEIGHT: u64 = 10;           // 点赞权重降至10%
    //     const COMMENT_WEIGHT: u64 = 15;        // 评论权重降至15%
    //     const NFT_REVENUE_WEIGHT: u64 = 20;    // NFT收益权重20%

    //     // 基础算力
    //     let base_power = (self.weekly_word_count / 1000) * WORD_COUNT_WEIGHT +
    //                     (self.like_count * LIKE_WEIGHT) / 100 +
    //                     (self.comment_count * COMMENT_WEIGHT) / 50 +
    //                     ((self.total_tip_revenue_sol / LAMPORTS_PER_SOL + 
    //                       self.total_tip_revenue_token / 100_000) * TIP_WEIGHT) / 100;

    //     // NFT总收益算力 (基于累计收益)
    //     let nft_power = match self.total_nft_revenue_sol {
    //         0..=1_000_000_000 => 100,            // 基础算力 (0-1000 SOL)
    //         1_000_000_001..=5_000_000_000 => 200,  // 初级算力 (1000-5000 SOL)
    //         5_000_000_001..=10_000_000_000 => 400, // 中级算力 (5000-10000 SOL)
    //         10_000_000_001..=50_000_000_000 => 800,// 高级算力 (10000-50000 SOL)
    //         _ => 1600                             // 顶级算力 (50000+ SOL)
    //     };

    //     // 如果使用 TAFOR 支付，每 10w 代币增加 1 点权重.暂时这样换算
    //     let token_weight = self.total_nft_revenue_token / 100000;

    //     let total_base_power = base_power + ((nft_power + token_weight) * NFT_REVENUE_WEIGHT) / 100;

    //     // 2. 等级倍率 (更平滑的增长曲线)
    //     let level_multiplier = match total_base_power {
    //         0..=1000 => 1.0,     // 铜牌 (入门级)
    //         1001..=3000 => 1.5,  // 白银 (进阶级)
    //         3001..=6000 => 2.5,  // 黄金 (优秀级)
    //         6001..=10000 => 4.0, // 白金 (精英级)
    //         10001..=15000 => 8.0,// 钻石 (大神级)
    //         _ => 16.0,           // 传说 (现象级)
    //     };

    //     // 3. 爆发增益 (突出优秀表现)
    //     let burst_bonus = if self.is_trending() {  // 判断是否处于爆发期
    //         total_base_power * 2  // 爆发期双倍算力
    //     } else {
    //         0
    //     };

    //     // 4. 最终算力计算
    //     let adjusted_power = (base_power as f64 * level_multiplier) as u64;
    //     self.mining_power = adjusted_power + burst_bonus;

    //     Ok(())
    // }

    // 判断是否处于爆发期（24小时内的数据）（注意少了更新字数这个因数，这也是个很重要的因子）
    fn is_trending(&self) -> bool {
        const TRENDING_THRESHOLD_LIKES: u64 = 500;      // 24小时内500个点赞
        const TRENDING_THRESHOLD_COMMENTS: u64 = 200;   // 24小时内200条评论
        const TRENDING_THRESHOLD_TIPS_SOL: u64 = 10 * LAMPORTS_PER_SOL; // 24小时内10 SOL打赏
        const TRENDING_THRESHOLD_TIPS_TOKEN: u64 = 1000; // 24小时内1000w TAFOR打赏
        
        // 使用 unwrap_or 处理 Result
        let current_time = Clock::get().unwrap().unix_timestamp;
        let recent_likes = self.get_recent_likes(current_time, DAY_IN_SECONDS);
        let recent_comments = self.get_recent_comments(current_time, DAY_IN_SECONDS);
        let (recent_tips_sol, recent_tips_token) = self.get_recent_tips(current_time, DAY_IN_SECONDS);

        recent_likes > TRENDING_THRESHOLD_LIKES ||
        recent_comments > TRENDING_THRESHOLD_COMMENTS ||
        recent_tips_sol > TRENDING_THRESHOLD_TIPS_SOL ||
        recent_tips_token > TRENDING_THRESHOLD_TIPS_TOKEN
    }

    pub fn get_recent_likes(&self, current_time: i64, duration: i64) -> u64 {
        // TODO: 实现获取最近点赞数的逻辑
        self.like_count
    }

    pub fn get_recent_comments(&self, current_time: i64, duration: i64) -> u64 {
        // TODO: 实现获取最近评论数的逻辑
        self.comment_count
    }

    pub fn get_recent_tips(&self, current_time: i64, duration: i64) -> (u64, u64) {
        // TODO: 实现获取最近打赏数的逻辑
        // 返回元组 (SOL打赏金额, TAFOR打赏金额)
        (self.total_tip_revenue_sol, self.total_tip_revenue_token)
    }

    pub fn get_nft_holders(&self) -> Result<Vec<Pubkey>> {
        // 这里需要实现获取 NFT 持有者的逻辑
        // 暂时返回空列表
        Ok(vec![])
    }

    pub fn check_abandoned_status(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        
        // 检查是否太监（30天未更新且未完成）
        if !self.is_completed && 
           current_time - self.last_update_time > MAX_INACTIVE_DAYS * 24 * 60 * 60 {
            self.is_abandoned = true;
            
            // 计算SOL分配
            let platform_share_sol = self.staked_earnings_sol * ABANDONED_PLATFORM_SHARE as u64 / 100;
            let holder_share_sol = self.staked_earnings_sol - platform_share_sol;
            
            // 计算TAFOR分配
            let platform_share_token = self.staked_earnings_token * ABANDONED_PLATFORM_SHARE as u64 / 100;
            let holder_share_token = self.staked_earnings_token - platform_share_token;
            
            // 发出SOL质押放弃事件
            if self.staked_earnings_sol > 0 {
            emit!(StoryAbandoned {
                story: self.author.key(),
                    staked_amount: self.staked_earnings_sol,
                    platform_share: platform_share_sol,
                    holder_share: holder_share_sol,
                    use_token: false,
                timestamp: current_time,
            });
            }

            // 发出TAFOR质押放弃事件
            if self.staked_earnings_token > 0 {
                emit!(StoryAbandoned {
                    story: self.author.key(),
                    staked_amount: self.staked_earnings_token,
                    platform_share: platform_share_token,
                    holder_share: holder_share_token,
                    use_token: true,
                    timestamp: current_time,
                });
            }
        }
        Ok(())
    }
}

//对于作品，是以钱包为拥有者的，不是作者账户。钱包可以看成是邮箱或者应用的账号，该账号下有作者账户。
#[derive(Accounts)]
pub struct CreateStory<'info> {
    #[account(
        init,
        payer = author_wallet,
        space = 8 + // discriminator
               100 + // title
               1000 + // description
               32 + // author
               50 + // pen_name
               100 + // cover_cid
               100 + // content_cid
               4 + // chapter_count
               1 + // is_completed
               8 + // created_at
               8 + // updated_at
               4 + // nft_count
               8 + // like_count
               8 + // comment_count
               8 + // word_count
               8 + // weekly_word_count
               8 + // last_word_reset
               1 + // avg_rating
               4 + // rating_count
               8 + // mining_power
               4 + // max_nfts
               1 + // first_mint_completed
               1 + // second_mint_enabled
               8 + // target_word_count
               8 + // total_nft_revenue_sol
               8 + // total_nft_revenue_token
               8 + // total_tip_revenue_sol
               8 + // total_tip_revenue_token
               8 + // last_nft_revenue_update
               8 + // last_tip_update
               8 + // staked_earnings_sol
               8 + // staked_earnings_token
               1 + // is_abandoned
               8 + // last_update_time
               8 + // min_words_for_nft
               8 + // unclaimed_mining_reward
               8 + // last_claimed_period
               32 + // unclaimed_periods vector
               8 + // last_mining_power_update
               8 + // current_period_likes
               8 + // current_period_comments
               8 + // current_period_tips_sol
               8 + // current_period_tips_token
               8 + // current_period_words
               1,  // is_active
        seeds = [b"story", author_wallet.key().as_ref(), author.story_count.to_le_bytes().as_ref()],
        bump
    )]
    pub story: Account<'info, Story>,
    
    // 作者钱包地址
    #[account(mut)]
    pub author_wallet: Signer<'info>,
    
    // 作者账户
    #[account(
        mut,
        // 作者账户地址等于作者钱包地址
        constraint = author.address == author_wallet.key() @ TaleForgeError::InvalidAuthor
    )]
    pub author: Account<'info, Author>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TipStory<'info> {
    #[account(mut)]
    pub story: Account<'info, Story>,
    #[account(mut)]
    pub tipper: Signer<'info>,
    /// CHECK: 作者账户
    #[account(mut)]
    pub author: AccountInfo<'info>,
    #[account(mut)]
    pub story_token: Option<Account<'info, TokenAccount>>,  // 故事的质押账户
    #[account(mut)]
    pub tipper_token: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub author_token: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub platform_token: Option<Account<'info, TokenAccount>>,  // 平台的TAFOR账户
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
  
    #[account(
        mut,
        constraint = author_account.address == author.key() @ TaleForgeError::InvalidAuthor
    )]
    pub author_account: Account<'info, Author>,  // 添加作者账户
}

#[derive(Accounts)]
pub struct UpdateChapter<'info> {
    #[account(
        mut,
        constraint = story.author == author.key() @ TaleForgeError::InvalidAuthor
    )]
    pub story: Account<'info, Story>,
    
    #[account(mut)]
    pub author: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub struct ChapterMetadata {
    pub title: String,
    pub cid: String,
    pub created_at: i64,
    pub word_count: u32,
}

// 作品分类 这个应该可以不用。
// #[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
// pub enum StoryCategory {
//     Fantasy,
//     SciFi,
//     Romance,
//     Mystery,
//     Other,
// }

#[derive(Accounts)]
pub struct LikeStory<'info> {
    #[account(mut)]
    pub story: Account<'info, Story>,
    pub user: Signer<'info>,
}
#[derive(Accounts)]
pub struct AddComment<'info> {
    #[account(mut)]
    pub story: Account<'info, Story>,
    pub user: Signer<'info>,
}
#[derive(Accounts)]
pub struct UpdateWordCount<'info> {
    #[account(
        mut,
        has_one = author,
    )]
    pub story: Account<'info, Story>,
    pub author: Signer<'info>,
    #[account(
        mut,
        constraint = author_account.address == author.key() @ TaleForgeError::InvalidAuthor
    )]
    pub author_account: Account<'info, Author>,  // 添加作者账户
}
#[derive(Accounts)]
pub struct CompleteStory<'info> {
    #[account(mut)]
    pub story: Account<'info, Story>,
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(mut)]
    pub story_token: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub author_token: Option<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct UpdateStorySettings<'info> {
    #[account(mut)]
    pub story: Account<'info, Story>,
    #[account(mut)]
    pub author: Signer<'info>,

    // 平台权限账户
    // #[account(
    //     constraint = authority.key() == PLATFORM_AUTHORITY
    // )]
    #[account(mut)]
    pub authority: Signer<'info>,
}



#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum CurrencyType {
    SOL,
    TAFOR
}

#[derive(Accounts)]
pub struct CreateNFT<'info> {
    #[account(
        mut,
        has_one = author,
    )]
    pub story: Account<'info, Story>,
    #[account(
        init,
        payer = author,
        space = 8 + 32 + 200 + 200 + 200 + 4 + 4 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8
    )]
    pub nft: Account<'info, NovelNFT>,
    #[account(mut)]
    pub author: Signer<'info>,
    /// CHECK: 用于生成随机数的最近区块哈希
    pub recent_blockhash: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

// 新增 NFT 结构
#[account]
pub struct NovelNFT {
    pub story: Pubkey,         // 关联的故事
    pub name: String,          // NFT 名称
    pub description: String,   // NFT 描述
    pub image_uri: String,     // NFT.Storage URI
    pub nft_type: NFTType,     // NFT 类型
    pub rarity: Rarity,        // 稀有度
    pub owner: Pubkey,         // 所有者
    pub created_at: i64,       // 创建时间
    pub is_transferable: bool, // 是否可转让
    pub mint_batch: u8,        // 铸造批次  (这个参数与下面参数重复了，保留一个即可)
    pub mining_weight: u64,    // 挖矿权重
    pub is_listed: bool,       // 是否在售
    pub list_time: i64,        // 挂单时间
    pub list_price_sol: u64,   // SOL 定价
    pub list_price_token: u64, // TAFOR 定价
    pub staked_earnings: u64,  // 质押的挖矿收益
    pub earnings_start_time: i64,  // 开始计算收益的时间
}

// 修改 Rarity 枚举，只保留质押时间相关的逻辑
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Rarity {
    Common,     // 普通 - 需要质押365天（1年）
    Rare,       // 稀有 - 需要质押180天（半年）
    Epic,       // 史诗 - 需要质押90天（3个月）
    Legendary,  // 传说 - 无需质押
}

impl Rarity {
    // 获取质押时间要求（秒）
    pub fn get_stake_requirement(&self) -> i64 {
        match self {
            Rarity::Common => 365 * 24 * 60 * 60,    // 365天（1年）
            Rarity::Rare => 180 * 24 * 60 * 60,      // 180天（半年）
            Rarity::Epic => 90 * 24 * 60 * 60,       // 90天（3个月）
            Rarity::Legendary => 0,                   // 无需质押
        }
    }

    // 随机生成稀有度
    pub fn random(recent_blockhash: &[u8]) -> Self {
        let seed = recent_blockhash[0] as u32;  // 使用最近的区块哈希作为随机种子
        let roll = seed % 1000;  // 0-999的随机数

        match roll {
            0..=649 => Rarity::Common,    // 65%
            650..=899 => Rarity::Rare,    // 25%
            900..=979 => Rarity::Epic,    // 8%
            _ => Rarity::Legendary,       // 2%
        }
    }
}

#[derive(Accounts)]
pub struct TransferNFT<'info> {
    #[account(mut)]
    pub nft: Account<'info, NovelNFT>,
    #[account(mut)]
    pub story: Account<'info, Story>, // 关联的故事
    pub current_owner: Signer<'info>,
    /// CHECK: 新所有者地址
    pub new_owner: AccountInfo<'info>,
    /// CHECK: 用于接收转让费用的账户
    #[account(mut)]
    pub fee_receiver: AccountInfo<'info>,
    // SOL 转账需要
    pub system_program: Program<'info, System>,
    
    // TAFOR 代币转账需要
    #[account(mut)]
    pub buyer_token: Option<Account<'info, TaforAccount>>,
    #[account(mut)]
    pub seller_token: Option<Account<'info, TaforAccount>>,
    #[account(mut)]
    pub fee_receiver_token: Option<Account<'info, TaforAccount>>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub guard: Account<'info, ReentrancyGuard>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum NFTType {
    Character,  // 人物
    Scene,      // 场景
    Pet,        // 灵宠
    Item        // 物品
}

// #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
// pub enum Rarity {
//     Common,     // 普通
//     Rare,       // 稀有
//     Epic,       // 史诗
//     Legendary   // 传说
// }

// 添加相关账户结构
#[derive(Accounts)]
pub struct ListNFT<'info> {
    #[account(mut)]
    pub nft: Account<'info, NovelNFT>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub nft: Account<'info, NovelNFT>,
    pub owner: Signer<'info>,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MiningLevel {
    Copper,   // 铜牌 (基础)
    Silver,   // 白银 (进阶)
    Gold,     // 黄金 (优秀)
    Platinum, // 白金 (卓越)
    Diamond,  // 钻石 (顶级)
    Legend,   // 传说 (现象级)
}

// #[derive(Accounts)]
// #[instruction(nft_count: u8)]
// pub struct DistributeMiningRewards<'info> {
//     #[account(mut)]
//     pub mining_pool: Account<'info, MiningPool>,
//     #[account(mut)]
//     pub mining_pool_token: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub reader_reward_pool: Account<'info, ReaderRewardPool>,
//     #[account(mut)]
//     pub reader_pool_token: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub platform_token: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub author_token: Account<'info, TokenAccount>,
//     pub authority: Signer<'info>,
//     pub token_program: Program<'info, Token>,
//     pub system_program: Program<'info, System>,
//     /// CHECK: This is safe because we only read from it
//     pub clock: AccountInfo<'info>,
// }

// 修改 DistributeMiningRewards 结构体
#[derive(Accounts)]
pub struct DistributeMiningRewards<'info> {
    #[account(mut)]
    pub mining_pool: Account<'info, MiningPool>,
    #[account(mut)]
    pub mining_pool_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reader_pool_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"active_stories"],
        bump
    )]
    pub active_stories: Account<'info, ActiveStories>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// 添加新的事件
#[event]
pub struct WeeklyCalculationCompleted {
    pub period: u64,
    pub total_mining_power: u64,
    pub reward_per_power: u64,
    pub total_rewards: u64,
    pub timestamp: i64,
}

impl<'info> DistributeMiningRewards<'info> {
    // 平台分红
    pub fn into_platform_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.mining_pool_token.to_account_info(),
            to: self.platform_token.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        )
    }

    // 作者分红
    pub fn into_author_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.mining_pool_token.to_account_info(),
            to: self.author_token.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        )
    }
    // NFT持有者分红(未使用,直接从平台账户转出)
    // pub fn into_holder_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    //     CpiContext::new(
    //         self.token_program.to_account_info(),
    //         Transfer {
    //             from: self.mining_pool.to_account_info(),
    //             to: self.owner_token.to_account_info(),
    //             authority: self.authority.to_account_info(),
    //         },
    //     )
    // }
}

//读者抽奖
 // 读者活跃度记录
 #[account]
 #[derive(Default)]
 pub struct ReaderActivity {
     pub reader: Pubkey,            // 读者地址
     pub daily_check_ins: [i64; 30], // 固定大小的数组，最多存储30天的签到记录
     pub check_in_count: u8,        // 当前签到记录数量
     pub last_check_in: i64,        // 最后签到时间
     pub monthly_active_days: u8,   // 本月活跃天数
     pub lottery_weight: u32,       // 抽奖权重
     pub comment_count: u32,        // 评论数
     pub like_count: u32,          // 点赞数
 }

 // 读者签到
 #[derive(Accounts)]
pub struct ReaderCheckIn<'info> {
    #[account(mut)]
    pub reader_activity: Account<'info, ReaderActivity>,
    pub user: Signer<'info>,
}
// 每月抽奖
#[derive(Accounts)]
pub struct MonthlyLottery<'info> {
    #[account(mut)]
    pub reader_reward_pool: Account<'info, ReaderRewardPool>,
    #[account(mut)]
    pub reader_activities: Account<'info, ReaderActivity>,
    pub authority: Signer<'info>,  // 添加权限账户
    #[account(mut)]
    pub winner_token: Account<'info, TaforAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> MonthlyLottery<'info> {
    pub fn into_winner_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.reader_reward_pool.to_account_info(),
            to: self.winner_token.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(
            self.token_program.to_account_info(),
            cpi_accounts,
        )
    }
}


//***事件 */
#[event]
pub struct StoryCreated {
    pub story: Pubkey,
    pub author: Pubkey,
    pub title: String,
    pub target_words: u64,
    pub timestamp: i64,
}

#[event]
pub struct ChapterUpdated {
    pub story: Pubkey,
    pub chapter_number: u32,
    pub timestamp: i64,
}

#[event]
pub struct StoryTipped {
    pub story: Pubkey,
    pub tipper: Pubkey,
    pub amount: u64,
    pub use_token: bool,    // 标记使用的是哪种货币
    pub staked_amount: u64,  // 添加质押金额
    pub timestamp: i64,
}


#[event]
pub struct NFTMinted {
    pub story: Pubkey,
    pub nft: Pubkey,
    pub nft_type: NFTType,
    pub rarity: Rarity,
    pub timestamp: i64,
}


#[event]
pub struct StoryLiked {
    pub story: Pubkey,
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StoryCommented {
    pub story: Pubkey,
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WordCountUpdated {
    pub story: Pubkey,
    pub total_words: u64,
    pub weekly_words: u64,
    pub author_total_words: u64,  // 添加作者总字数
    pub timestamp: i64,
}

// 添加新的事件
#[event]
pub struct LotterySkipped {
    pub reason: String,
    pub accumulated_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MinimalLotteryCompleted {
    pub winner_count: u32,
    pub distributed_amount: u64,
    pub reserved_amount: u64,
    pub timestamp: i64,
}

// 添加 NFT 挂单事件
#[event]
pub struct NFTListed {
    pub story: Pubkey,
    pub nft: Pubkey,
    pub owner: Pubkey,
    pub price_sol: u64,
    pub price_token: u64,
    pub timestamp: i64,
}

// 添加 NFT 购买事件
#[event]
pub struct NFTSold {
    pub story: Pubkey,
    pub nft: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
    pub platform_fee: u64,
    pub use_token: bool,  // true: TAFOR, false: SOL
    pub timestamp: i64,
}

// 添加取消挂单事件
#[event]
pub struct NFTListingCanceled {
    pub story: Pubkey,
    pub nft: Pubkey,
    pub owner: Pubkey,
    pub timestamp: i64,
}


// 添加新的事件
#[event]
pub struct StoryMiningPowerUpdated {
    pub story: Pubkey,
    pub old_power: u64,
    pub new_power: u64,
    pub timestamp: i64,
}

// 添加挖矿奖励事件
#[event]
pub struct MiningRewardDistributed {
    pub story: Pubkey,
    pub total_reward: u64,
    pub platform_reward: u64,
    pub reader_pool_reward: u64,
    pub remaining_reward: u64,
    pub active_stories_count: u32,
    pub total_mining_power: u64,
    pub timestamp: i64,
}

// 添加错误类型
#[error_code]
pub enum TaleForgeError {
    #[msg("Title length must be between 1 and 100 characters")]
    InvalidTitleLength,
    #[msg("Description length must be between 1 and 1000 characters")]
    InvalidDescriptionLength,
    #[msg("Pen name length must be between 1 and 50 characters")]
    InvalidPenNameLength,
    #[msg("Invalid CID format")]
    InvalidCIDFormat,
    #[msg("Story is already completed")]
    StoryAlreadyCompleted,
    #[msg("Unauthorized author")]
    UnauthorizedAuthor,
    #[msg("Unauthorized NFT owner")]
    UnauthorizedOwner,
    #[msg("Invalid chapter number")]
    InvalidChapterNumber,
    #[msg("Invalid NFT metadata")]
    InvalidNFTMetadata,
    #[msg("Maximum NFTs reached for this story")]
    MaxNFTsReached,
    #[msg("Invalid tip amount")]
    InvalidTipAmount,
    #[msg("No eligible readers for lottery")]
    NoEligibleReaders,
    #[msg("Too early for lottery")]
    TooEarlyForLottery,
    #[msg("Already checked in today")]
    AlreadyCheckedIn,
    #[msg("Empty reward pool")]
    EmptyRewardPool,
    #[msg("No active readers")]
    NoActiveReaders,
    #[msg("Insufficient eligible readers")]
    InsufficientEligibleReaders,
    #[msg("NFT minting is disabled for this story")]
    NFTMintingDisabled,
    #[msg("NFT is not transferable")]
    NFTNotTransferable,
    #[msg("Too early to distribute mining rewards")]
    TooEarlyToDistribute,
    #[msg("Insufficient word count for NFT minting")]
    InsufficientWordCount,
    #[msg("Maximum first batch NFTs reached")]
    MaxFirstBatchNFTsReached,
    #[msg("First mint must be completed before second mint")]
    FirstMintNotCompleted,
    #[msg("Second mint not enabled yet")]
    SecondMintNotEnabled,
    #[msg("NFT is already listed")]
    NFTAlreadyListed,
    #[msg("NFT is not listed for sale")]
    NFTNotListed,
    #[msg("Invalid listing price")]
    InvalidListPrice,
    #[msg("Token accounts required for token payment")]
    TokenAccountsRequired,
    #[msg("Invalid payment method")]
    InvalidPaymentMethod,
    #[msg("Invalid listing prices")]
    InvalidListPrices,
    #[msg("Currency type mismatch")]
    CurrencyTypeMismatch,
    #[msg("Reentrancy detected")]
    ReentrancyError,
    #[msg("Target word count must be at least 50,000")]
    InvalidTargetWordCount,
    #[msg("Story is abandoned")]
    StoryAbandoned,
    #[msg("Target word count not met")]
    TargetWordCountNotMet,
    #[msg("Invalid author")]
    InvalidAuthor,
    #[msg("Author not initialized")]
    AuthorNotInitialized,
    #[msg("Invalid author statistics update")]
    InvalidAuthorStats,
    #[msg("Invalid unstake amount")]
    InvalidUnstakeAmount,
    #[msg("Pen name already exists")]
    PenNameAlreadyExists,
    #[msg("Maximum stories exceeded")]
    MaxStoriesExceeded,
    #[msg("Invalid pen name")]
    InvalidPenName,
    #[msg("Invalid word count")]
    InvalidWordCount,
    #[msg("Invalid NFT limit")]
    InvalidNFTLimit,
    #[msg("Unauthorized platform operation")]
    UnauthorizedPlatform,
    // #[msg("NFT already staked")]
    // NFTAlreadyStaked,
    // #[msg("NFT not staked")]
    // NFTNotStaked,
    // #[msg("Stake period not completed")]
    // StakePeriodNotCompleted,
    // #[msg("Legendary NFT does not require staking")]
    // LegendaryNFTNoStakeRequired,
    #[msg("No staked earnings to release")]
    NoStakedEarnings,
    #[msg("Invalid NFT")]
    InvalidNFT,
    #[msg("Stake period not met")]
    StakePeriodNotMet,
    // #[msg("NFT token accounts count does not match NFTs count")]
    // InvalidNFTTokenAccounts,
    #[msg("No active stories found")]
    NoActiveStories,
    #[msg("Failed to load story data")]
    StoryLoadError,
    #[msg("Failed to load NFT data")]
    NFTLoadError,
    #[msg("Failed to process mining rewards")]
    MiningRewardError,
    #[msg("Failed to update mining power")]
    MiningPowerUpdateError,
    #[msg("Failed to distribute rewards")]
    RewardDistributionError,
    #[msg("Invalid mining power calculation")]
    InvalidMiningPower,
    GlobalStoryListFull,
    #[msg("Calculation is already in progress")]
    CalculationInProgress,
    #[msg("Not in calculation period")]
    NotInCalculationPeriod,
    #[msg("Too early to calculate mining power")]
    TooEarlyToCalculate,
    #[msg("Batch size exceeded")]
    BatchSizeExceeded,
    #[msg("Invalid batch")]
    InvalidBatch,
    #[msg("Not all batches completed")]
    BatchesNotCompleted,
    #[msg("No unclaimed rewards")]
    NoUnclaimedRewards,
    #[msg("Period reward not found")]
    PeriodRewardNotFound,

    #[msg("Story not active")]
    StoryNotActive,
    #[msg("Story already processed")]
    StoryAlreadyProcessed,

    #[msg("Invalid reward distribution")]
    InvalidRewardDistribution,
}


// 添加重入锁结构体定义
#[account]
pub struct ReentrancyGuard {
    pub is_entered: bool,
}

#[event]
pub struct PlatformInitialized {
    pub mining_pool: Pubkey,
    pub reader_reward_pool: Pubkey,
    pub mint: Pubkey,
    pub initial_mining_supply: u64,
    pub treasury_reserve: u64,
    pub timestamp: i64,
}

#[event]
pub struct StoryAbandoned {
    pub story: Pubkey,  // 故事的 Pubkey
    pub staked_amount: u64,  // 质押金额
    pub platform_share: u64,  // 平台分享
    pub holder_share: u64,  // 持有者分享
    pub use_token: bool,  // true: TAFOR, false: SOL
    pub timestamp: i64,  // 时间戳
}

#[event]
pub struct StakeReleased {
    pub story: Pubkey,
    pub author: Pubkey,
    pub amount: u64,
    pub use_token: bool,  // true: TAFOR, false: SOL
    pub timestamp: i64,
}

 // 添加笔名更新事件
 #[event]
 pub struct PenNameUpdated {
     pub author: Pubkey,
     pub old_pen_name: String,
     pub new_pen_name: String,
     pub timestamp: i64,
 }


#[account]
#[derive(Default)]
pub struct PenNameRecord {
    pub pen_name: String,     // 笔名
    pub owner: Pubkey,        // 所有者地址
    pub created_at: i64,      // 创建时间
}

#[event]
pub struct WeeklyCalculationStarted {
    pub period: u64,
    pub total_stories: u32,
    pub total_batches: u32,
    pub timestamp: i64,
}

#[event]
pub struct BatchCompleted {
    pub batch: u32,
    pub stories_processed: u32,
    pub is_final_batch: bool,
    pub timestamp: i64,
}

// 更新 RewardsDistributed 事件
#[event]
pub struct RewardsDistributed {
    pub story: Pubkey,
    pub author: Pubkey,
    pub period: u64,
    pub mining_power: u64,
    pub total_reward: u64,
    pub reader_pool_reward: u64,
    pub platform_reward: u64,
    pub author_reward: u64,
    pub nft_reward: u64,
    pub timestamp: i64,
}










   
    














