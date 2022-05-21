// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

contract Dex{

    enum Side {
        BUY,
        SELL
    }

    struct Token{
        bytes32 ticker;
        address tokenAddress;
    }

    struct order {
        uint id;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }

    mapping(bytes32 => Token) public token;

    mapping(address => mapping(bytes32 => uint)) public tradersBalances;

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;

    bytes32[] public tokenList;

    address public admin;

    uint public nextOrderId; 

    uint constant DAI = bytes('DAI');

    constructor(){
        admin = msg.sender;
    }

    function addToken (bytes32 ticker, address tokenAddress) external onlyAdmin{
        token[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    function deposit(uint amount, bytes32 ticker) external tokenExist(ticker){
        IERC20(token[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        tradersBalances[msg.sender][ticker] += amount;
    }


    function withdraw (uint amount, bytes32 ticker) external tokenExist(ticker){
        require(amount <= tradersBalances[msg.sender][ticker], "balance too low");

        tradersBalances[msg.sender][ticker] -= amount;

        IERC20(token[ticker].tokenAddress).transfer(
            msg.sender,
            amount
        );
    }

    function createLimitOrder(bytes32 ticker, uint amount, uint price, Side side) external{

        require(ticker != DAI, "Cannot trade DAI");

        if(side == Side.SELL){

            require(tradersBalances[msg.sender][ticker] >= amount, "token balance too low");

        }else{

            require(tradersBalances[msg.sender][DAI] >= amount * price, "DAI balance too low");
            
        }
    }

    modifier onlyAdmin{
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier tokenExist(bytes32 ticker){
        require(token[ticker].tokenAddress != address(0), "token does not exist");
        _;
    }
}