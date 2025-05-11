// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuthorToken
 * @dev 作者个人代币合约，用于创建作者个人代币
 */
contract AuthorToken is ERC20, Ownable {
    address public author;          // 作者地址
    address public platformTreasury;// 平台金库
    uint256 public creationDate;    // 创建日期
    uint256 public commitedRevenue; // 承诺的收入比例(基点,1%=100)
    
    // 代币功能激活状态
    bool public priorityReadingEnabled = true;
    bool public exclusiveCommentEnabled = true;
    bool public votingEnabled = false;
    bool public customChapterEnabled = false;
    
    // 代币持有阈值
    uint256 public constant PRIORITY_READING_THRESHOLD = 100 * 10**18;  // 100枚代币
    uint256 public constant EXCLUSIVE_COMMENT_THRESHOLD = 500 * 10**18; // 500枚代币
    uint256 public constant VOTING_THRESHOLD = 1000 * 10**18;           // 1000枚代币
    uint256 public constant CUSTOM_CHAPTER_THRESHOLD = 5000 * 10**18;   // 5000枚代币
    
    // 事件
    event RevenueCommitted(uint256 amount, address currency);
    event TokenBuyback(uint256 amount, uint256 bnbAmount);
    event FeatureToggled(string featureType, bool enabled);
    
    /**
     * @dev 构造函数
     * @param name 代币名称
     * @param symbol 代币符号
     * @param _author 作者地址
     * @param _platformTreasury 平台金库地址
     * @param _commitedRevenue 承诺的收入比例(基点,1%=100)
     */
    constructor(
        string memory name,
        string memory symbol,
        address _author,
        address _platformTreasury,
        uint256 _commitedRevenue
    ) ERC20(name, symbol) {
        require(_author != address(0), "Author cannot be zero address");
        require(_platformTreasury != address(0), "Treasury cannot be zero address");
        require(_commitedRevenue >= 500 && _commitedRevenue <= 3000, "Commited revenue must be between 5% and 30%");
        
        author = _author;
        platformTreasury = _platformTreasury;
        creationDate = block.timestamp;
        commitedRevenue = _commitedRevenue;
        
        // 初始分配
        _mint(_author, 400000 * 10**decimals());           // 40% 给作者
        _mint(_platformTreasury, 300000 * 10**decimals()); // 30% 给平台流动性池
        _mint(address(this), 300000 * 10**decimals());     // 30% 留给读者激励和平台储备
        
        // 转移合约所有权给作者
        transferOwnership(_author);
    }
    
    /**
     * @dev 作者提交收入用于回购
     */
    function commitRevenue() external payable {
        require(msg.value > 0, "Must send BNB");
        emit RevenueCommitted(msg.value, address(0)); // address(0)表示BNB
        
        // 这里可以接入DEX进行自动回购，简化版本中省略
    }
    
    /**
     * @dev 作者提交ERC20代币收入用于回购
     * @param tokenAddress ERC20代币地址
     * @param amount 代币数量
     */
    function commitRevenueERC20(address tokenAddress, uint256 amount) external {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        // 转移ERC20代币到合约
        // 注意：调用者需要先approve授权
        IERC20 token = IERC20(tokenAddress);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        emit RevenueCommitted(amount, tokenAddress);
        
        // 这里可以接入DEX进行自动回购，简化版本中省略
    }
    
    /**
     * @dev 执行代币回购
     * @param bnbAmount 用于回购的BNB数量
     * @param tokenAmount 回购的代币数量
     */
    function executeBuyback(uint256 bnbAmount, uint256 tokenAmount) external onlyOwner {
        require(bnbAmount <= address(this).balance, "Insufficient BNB balance");
        require(tokenAmount <= balanceOf(msg.sender), "Insufficient token balance");
        
        // 转移BNB到作者
        (bool success, ) = payable(author).call{value: bnbAmount}("");
        require(success, "BNB transfer failed");
        
        // 销毁代币
        _burn(msg.sender, tokenAmount);
        
        emit TokenBuyback(tokenAmount, bnbAmount);
    }
    
    /**
     * @dev 检查用户是否有特定权益
     * @param user 用户地址
     * @param privilegeType 权益类型
     * @return 是否有权益
     */
    function checkUserPrivilege(address user, string memory privilegeType) 
        external view returns (bool) {
        uint256 balance = balanceOf(user);
        
        if (keccak256(bytes(privilegeType)) == keccak256(bytes("priorityReading"))) {
            return priorityReadingEnabled && balance >= PRIORITY_READING_THRESHOLD;
        } else if (keccak256(bytes(privilegeType)) == keccak256(bytes("exclusiveComment"))) {
            return exclusiveCommentEnabled && balance >= EXCLUSIVE_COMMENT_THRESHOLD;
        } else if (keccak256(bytes(privilegeType)) == keccak256(bytes("voting"))) {
            return votingEnabled && balance >= VOTING_THRESHOLD;
        } else if (keccak256(bytes(privilegeType)) == keccak256(bytes("customChapter"))) {
            return customChapterEnabled && balance >= CUSTOM_CHAPTER_THRESHOLD;
        }
        
        return false;
    }
    
    /**
     * @dev 作者切换功能开关
     * @param featureType 功能类型
     * @param enabled 是否启用
     */
    function toggleFeature(string memory featureType, bool enabled) external onlyOwner {
        if (keccak256(bytes(featureType)) == keccak256(bytes("priorityReading"))) {
            priorityReadingEnabled = enabled;
        } else if (keccak256(bytes(featureType)) == keccak256(bytes("exclusiveComment"))) {
            exclusiveCommentEnabled = enabled;
        } else if (keccak256(bytes(featureType)) == keccak256(bytes("voting"))) {
            votingEnabled = enabled;
        } else if (keccak256(bytes(featureType)) == keccak256(bytes("customChapter"))) {
            customChapterEnabled = enabled;
        } else {
            revert("Invalid feature type");
        }
        
        emit FeatureToggled(featureType, enabled);
    }
    
    /**
     * @dev 更新承诺收入比例
     * @param newCommitedRevenue 新的承诺收入比例
     */
    function updateCommitedRevenue(uint256 newCommitedRevenue) external onlyOwner {
        require(newCommitedRevenue >= 500 && newCommitedRevenue <= 3000, "Must be between 5% and 30%");
        commitedRevenue = newCommitedRevenue;
    }
    
    /**
     * @dev 从读者激励池中分配代币给读者
     * @param reader 读者地址
     * @param amount 分配数量
     */
    function allocateToReader(address reader, uint256 amount) external {
        require(msg.sender == author || msg.sender == platformTreasury, "Not authorized");
        require(reader != address(0), "Invalid reader address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(address(this)) >= amount, "Insufficient balance in pool");
        
        _transfer(address(this), reader, amount);
    }
    
    /**
     * @dev 接收BNB
     */
    receive() external payable {}
} 