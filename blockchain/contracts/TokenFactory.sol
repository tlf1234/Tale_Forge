// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AuthorToken.sol";
import "./AuthorManager.sol";

/**
 * @title TokenFactory
 * @dev 代币工厂合约，用于创建和管理作者代币
 */
contract TokenFactory is Ownable, ReentrancyGuard {
    address public platformTreasury;
    AuthorManager public authorManager;
    
    // 作者地址 => 代币地址
    mapping(address => address) public authorTokens;
    // 代币符号 => 是否已使用
    mapping(string => bool) public usedSymbols;
    // 所有作者代币地址
    address[] public allAuthorTokens;
    
    // 发币资格条件
    uint256 public minWordCount = 500000;   // 最低字数要求
    uint256 public minLikeCount = 1000;     // 最低点赞数
    uint256 public minFollowerCount = 500;  // 最低粉丝数
    
    // 事件
    event TokenCreated(
        address indexed author, 
        address indexed tokenAddress, 
        string name, 
        string symbol, 
        uint256 commitedRevenue
    );
    event EligibilityRequirementsUpdated(
        uint256 minWordCount,
        uint256 minLikeCount,
        uint256 minFollowerCount
    );
    
    /**
     * @dev 构造函数
     * @param _platformTreasury 平台金库地址
     * @param _authorManager 作者管理合约地址
     */
    constructor(address _platformTreasury, address _authorManager) {
        require(_platformTreasury != address(0), "Treasury cannot be zero address");
        require(_authorManager != address(0), "AuthorManager cannot be zero address");
        
        platformTreasury = _platformTreasury;
        authorManager = AuthorManager(_authorManager);
    }
    
    /**
     * @dev 检查作者是否有资格发币
     * @param author 作者地址
     * @return 是否有资格
     */
    function checkEligibility(address author) public view returns (bool) {
        // 检查作者是否已注册
        require(authorManager.isAuthorRegistered(author), "Author not registered");
        
        // 检查作者是否已经有代币
        if (authorTokens[author] != address(0)) {
            return false;
        }
        
        // 获取作者统计数据
        (uint256 totalWordCount, uint256 likeCount, uint256 followerCount) = authorManager.getAuthorStats(author);
        
        // 检查是否满足任一条件
        return (
            totalWordCount >= minWordCount ||
            likeCount >= minLikeCount ||
            followerCount >= minFollowerCount ||
            authorManager.isSpecialAuthor(author) // 特邀作者绿色通道
        );
    }
    
    /**
     * @dev 创建作者代币
     * @param name 代币名称
     * @param symbol 代币符号
     * @param author 作者地址
     * @param commitedRevenue 承诺收入比例(基点,1%=100)
     * @return tokenAddress 新创建的代币地址
     */
    function createAuthorToken(
        string memory name,
        string memory symbol,
        address author,
        uint256 commitedRevenue
    ) external nonReentrant returns (address) {
        // 只有平台或作者本人可以创建代币
        require(msg.sender == owner() || msg.sender == author, "Not authorized");
        
        // 检查作者是否有资格发币
        require(checkEligibility(author), "Author not eligible");
        
        // 检查代币符号是否已被使用
        require(!usedSymbols[symbol], "Symbol already used");
        
        // 创建新代币
        AuthorToken newToken = new AuthorToken(
            name,
            symbol,
            author,
            platformTreasury,
            commitedRevenue
        );
        
        address tokenAddress = address(newToken);
        
        // 更新映射
        authorTokens[author] = tokenAddress;
        usedSymbols[symbol] = true;
        allAuthorTokens.push(tokenAddress);
        
        emit TokenCreated(author, tokenAddress, name, symbol, commitedRevenue);
        return tokenAddress;
    }
    
    /**
     * @dev 更新发币资格条件
     * @param _minWordCount 最低字数要求
     * @param _minLikeCount 最低点赞数
     * @param _minFollowerCount 最低粉丝数
     */
    function updateEligibilityRequirements(
        uint256 _minWordCount,
        uint256 _minLikeCount,
        uint256 _minFollowerCount
    ) external onlyOwner {
        minWordCount = _minWordCount;
        minLikeCount = _minLikeCount;
        minFollowerCount = _minFollowerCount;
        
        emit EligibilityRequirementsUpdated(_minWordCount, _minLikeCount, _minFollowerCount);
    }
    
    /**
     * @dev 获取作者代币地址
     * @param author 作者地址
     * @return 代币地址
     */
    function getAuthorToken(address author) external view returns (address) {
        return authorTokens[author];
    }
    
    /**
     * @dev 获取所有作者代币数量
     * @return 代币数量
     */
    function getAuthorTokenCount() external view returns (uint256) {
        return allAuthorTokens.length;
    }
    
    /**
     * @dev 获取作者代币列表
     * @param startIndex 起始索引
     * @param count 获取数量
     * @return tokens 代币地址列表
     */
    function getAuthorTokens(uint256 startIndex, uint256 count) 
        external 
        view 
        returns (address[] memory tokens) {
        uint256 totalCount = allAuthorTokens.length;
        
        if (startIndex >= totalCount) {
            return new address[](0);
        }
        
        uint256 endIndex = startIndex + count;
        if (endIndex > totalCount) {
            endIndex = totalCount;
        }
        
        uint256 resultCount = endIndex - startIndex;
        tokens = new address[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            tokens[i] = allAuthorTokens[startIndex + i];
        }
        
        return tokens;
    }
    
    /**
     * @dev 更新平台金库地址
     * @param _platformTreasury 新的平台金库地址
     */
    function updatePlatformTreasury(address _platformTreasury) external onlyOwner {
        require(_platformTreasury != address(0), "Treasury cannot be zero address");
        platformTreasury = _platformTreasury;
    }
} 