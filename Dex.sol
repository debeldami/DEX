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

    struct Order {
        uint id;
        address trader;
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

    uint public nextTradeId;

    bytes32 constant DAI = bytes32('DAI');

    event NewTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );

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

    function createLimitOrder(bytes32 ticker, uint amount, uint price, Side side) external tokenIsNotDai(ticker){

        if(side == Side.SELL){

            require(tradersBalances[msg.sender][ticker] >= amount, "token balance too low");

        }else{

            require(tradersBalances[msg.sender][DAI] >= amount * price, "DAI balance too low");
            
        }

        Order[] storage orders = orderBook[ticker][uint(side)];

        orders.push(Order( nextOrderId, msg.sender, side, ticker, amount, 0, price, block.timestamp));

        uint i = orders.length - 1;

        while(i > 0){
            if(side == Side.BUY && orders[i-1].price > orders[i].price){
                break;
            }
            if(side == Side.SELL && orders[i-1].price < orders[i].price){
                break;
            }

            Order memory order = orders[i-1];
            orders[i-1] = orders[i];
            orders[i] = order;
            i--;
            nextOrderId++;
        }

    }

    function createMarketOrder(bytes32 ticker, uint amount, Side side) external tokenExist(ticker) tokenIsNotDai(ticker){
        if(side == Side.SELL){

            require(tradersBalances[msg.sender][ticker] >= amount, "token balance too low");

        }

        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];

        uint i;

        uint remaining = amount;

        while(i < orders.length && remaining > 0){

            uint available = orders[i].amount - orders[i].filled;

            uint matched = remaining > available ? available : remaining;

            remaining -= matched;

            orders[i].filled = matched;

            emit NewTrade( nextTradeId, orders[i].id, ticker, orders[i].trader, msg.sender, orders[i].amount, orders[i].price, block.timestamp);

            if(side == Side.SELL){

            tradersBalances[msg.sender][ticker] -= matched;

            tradersBalances[msg.sender][DAI] += matched * orders[i].price;

            tradersBalances[orders[i].trader][ticker] += matched;

            tradersBalances[orders[i].trader][DAI] -= matched * orders[i].price;

            }

            if(side == Side.BUY){

            require(tradersBalances[msg.sender][DAI] >= matched * orders[i].price, "dai balance too low" );

            tradersBalances[msg.sender][ticker] += matched;

            tradersBalances[msg.sender][DAI] -= matched * orders[i].price;

            tradersBalances[orders[i].trader][ticker] -= matched;

            tradersBalances[orders[i].trader][DAI] += matched * orders[i].price;

            }
            nextTradeId++;
            i++;
        }

        i = 0;

        while(i < orders.length && orders[i].filled == orders[i].amount){
            for(uint j = i; j < orders.length - 1; j++){
                orders[j] == orders[j + 1];
            }

            orders.pop();
            i++;
        }

        
    }

    modifier tokenIsNotDai(bytes32 ticker){
        require(ticker != DAI, "Cannot trade DAI");
        _;
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