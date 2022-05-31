const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');
const expectRevert = require('@openzeppelin/test-helpers/src/expectRevert');

const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Dex = artifacts.require('Dex');

const SIDE = {
  BUY: 0,
  SELL: 1,
};

contract('Dex', (accounts) => {
  let [trader1, trader2] = [accounts[1], accounts[2]];

  let dex, dai, rep, bat, zrx;

  let [DAI, REP, BAT, ZRX] = ['DAI', 'REP', 'BAT', 'ZRX'].map((ticker) =>
    web3.utils.fromAscii(ticker)
  );

  beforeEach(async () => {
    [dai, rep, bat, zrx] = await Promise.all([
      Dai.new(),
      Rep.new(),
      Bat.new(),
      Zrx.new(),
    ]);

    dex = await Dex.new();

    await Promise.all([
      dex.addToken(DAI, dai.address),
      dex.addToken(REP, dai.address),
      dex.addToken(BAT, dai.address),
      // dex.addToken(ZRX, dai.address),
    ]);

    const amount = web3.utils.toWei('1000');

    const seedTokenBalnce = async (token, trader) => {
      await token.faucet(trader, amount);
      await token.approve(dex.address, amount, {
        from: trader,
      });
    };

    await Promise.all(
      [dai, rep, bat, zrx].map((token) => seedTokenBalnce(token, trader1))
    );

    await Promise.all(
      [dai, rep, bat, zrx].map((token) => seedTokenBalnce(token, trader2))
    );
  });

  it('should deposit tokens', async () => {
    const amount = web3.utils.toWei('1000');

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    const balance = (await dex.tradersBalances(trader1, DAI)).toString();

    assert(balance === amount.toString());
  });

  it('should not deposit tokens if token does not exist', async () => {
    const amount = web3.utils.toWei('1000');

    await expectRevert(
      dex.deposit(amount, ZRX, {
        from: trader1,
      }),
      'token does not exist'
    );
  });

  it('should be able to withdraw', async () => {
    const amount = web3.utils.toWei('1000');

    await dex.deposit(amount, DAI, {
      from: trader1,
    });

    await dex.withdraw(amount, DAI, {
      from: trader1,
    });

    const [dexBalance, balance] = await Promise.all([
      dex.tradersBalances(trader1, DAI),
      dai.balanceOf(trader1),
    ]);

    assert(dexBalance.isZero());
    assert(balance.toString() === web3.utils.toWei('1000'));
  });

  it('should not withdraw token if token do not exist', async () => {
    const amount = web3.utils.toWei('1000');

    await expectRevert(
      dex.withdraw(amount, ZRX, {
        from: trader1,
      }),
      'token does not exist'
    );
  });

  it('should not withdraw token if balance is too low', async () => {
    const depositAmount = web3.utils.toWei('500');
    const withdrawAmount = web3.utils.toWei('1000');

    await dex.deposit(depositAmount, DAI, {
      from: trader1,
    });

    await expectRevert(
      dex.withdraw(withdrawAmount, DAI, {
        from: trader1,
      }),
      'balance too low'
    );
  });

  it('should create limit order', async () => {
    const depositAmount = web3.utils.toWei('100');

    await dex.deposit(depositAmount, DAI, {
      from: trader1,
    });

    await dex.createLimitOrder(BAT, web3.utils.toWei('10'), 10, SIDE.BUY, {
      from: trader1,
    });

    let buyOrder = await dex.getOrders(BAT, SIDE.BUY);
    let sellOrder = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrder.length === 1);
    assert(buyOrder[0].trader === trader1);
    assert(buyOrder[0].ticker === web3.utils.padRight(BAT, 64));
    assert(buyOrder[0].price === '10');
    assert(buyOrder[0].amount === web3.utils.toWei('10'));
    assert(sellOrder.length === 0);

    const depositAmount1 = web3.utils.toWei('200');

    await dex.deposit(depositAmount1, DAI, {
      from: trader2,
    });

    await dex.createLimitOrder(BAT, web3.utils.toWei('10'), 11, SIDE.BUY, {
      from: trader2,
    });

    buyOrder = await dex.getOrders(BAT, SIDE.BUY);
    sellOrder = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrder.length === 2);
    assert(buyOrder[0].trader === trader2);
    assert(buyOrder[1].trader === trader1);
    assert(sellOrder.length === 0);

    await dex.createLimitOrder(BAT, web3.utils.toWei('10'), 9, SIDE.BUY, {
      from: trader2,
    });

    buyOrder = await dex.getOrders(BAT, SIDE.BUY);
    sellOrder = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrder.length === 3);
    assert(buyOrder[0].trader === trader2);
    assert(buyOrder[1].trader === trader1);
    assert(buyOrder[2].trader === trader2);
    assert(buyOrder[2].price === '9');
    assert(sellOrder.length === 0);
  });

  it('should not create a new order if token do not exist', async () => {
    const depositAmount = web3.utils.toWei('100');

    await dex.deposit(depositAmount, DAI, {
      from: trader2,
    });

    await expectRevert(
      dex.createLimitOrder(ZRX, web3.utils.toWei('10'), 9, SIDE.BUY, {
        from: trader2,
      }),
      'token does not exist'
    );
  });

  it('should not create a limit order if token is DAI', async () => {
    await expectRevert(
      dex.createLimitOrder(DAI, web3.utils.toWei('10'), 9, SIDE.BUY, {
        from: trader2,
      }),
      'Cannot trade DAI'
    );
  });

  it('should not create a limit order if token is too low', async () => {
    const depositAmount = web3.utils.toWei('99');

    await dex.deposit(depositAmount, BAT, {
      from: trader2,
    });

    await expectRevert(
      dex.createLimitOrder(BAT, web3.utils.toWei('100'), 9, SIDE.SELL, {
        from: trader2,
      }),
      'token balance too low'
    );
  });

  it('should not create a limit order if DAI balance is too low', async () => {
    const depositAmount = web3.utils.toWei('99');

    await dex.deposit(depositAmount, DAI, {
      from: trader2,
    });

    await expectRevert(
      dex.createLimitOrder(BAT, web3.utils.toWei('10'), 10, SIDE.BUY, {
        from: trader2,
      }),
      'DAI balance too low'
    );
  });

  it('should create market order & match against existing limit order', async () => {
    await dex.deposit(web3.utils.toWei('100'), DAI, { from: trader1 });

    await dex.createLimitOrder(REP, web3.utils.toWei('10'), 10, SIDE.BUY, {
      from: trader1,
    });

    await dex.deposit(web3.utils.toWei('100'), REP, { from: trader2 });

    await dex.createMarketOrder(REP, web3.utils.toWei('5'), SIDE.SELL, {
      from: trader2,
    });

    const balances = await Promise.all([
      dex.tradersBalances(trader1, DAI),
      dex.tradersBalances(trader1, REP),
      dex.tradersBalances(trader2, DAI),
      dex.tradersBalances(trader2, REP),
    ]);

    const orders = await dex.getOrders(REP, SIDE.BUY);

    assert(orders.length === 1);

    assert((orders[0].filled = web3.utils.toWei('5')));
    assert(balances[0].toString() === web3.utils.toWei('50'));
    assert(balances[1].toString() === web3.utils.toWei('5'));
    assert(balances[2].toString() === web3.utils.toWei('50'));
    assert(balances[3].toString() === web3.utils.toWei('95'));
  });

  it('should NOT create market order if token balance too low', async () => {
    await expectRevert(
      dex.createMarketOrder(REP, web3.utils.toWei('101'), SIDE.SELL, {
        from: trader2,
      }),
      'token balance too low'
    );
  });

  it('should NOT create market order if dai balance too low', async () => {
    await dex.deposit(web3.utils.toWei('100'), REP, { from: trader1 });

    await dex.createLimitOrder(REP, web3.utils.toWei('100'), 10, SIDE.SELL, {
      from: trader1,
    });

    await expectRevert(
      dex.createMarketOrder(REP, web3.utils.toWei('101'), SIDE.BUY, {
        from: trader2,
      }),
      'dai balance too low'
    );
  });

  it('should NOT create market order if token is DAI', async () => {
    await expectRevert(
      dex.createMarketOrder(DAI, web3.utils.toWei('1000'), SIDE.BUY, {
        from: trader1,
      }),
      'Cannot trade DAI'
    );
  });

  it('should NOT create market order if token does not not exist', async () => {
    await expectRevert(
      dex.createMarketOrder(ZRX, web3.utils.toWei('1000'), SIDE.BUY, {
        from: trader1,
      }),
      'token does not exist'
    );
  });

  it('should cancel order', async () => {
    await dex.deposit(web3.utils.toWei('100'), DAI, { from: trader1 });

    await dex.createLimitOrder(REP, web3.utils.toWei('10'), 10, SIDE.BUY, {
      from: trader1,
    });

    const ordersB = await dex.getOrders(REP, SIDE.BUY);

    await dex.cancelOrder(REP, SIDE.BUY, 0, {
      from: trader1,
    });

    const ordersA = await dex.getOrders(REP, SIDE.BUY);

    assert(ordersB.length >= ordersA.length);
    assert(ordersA.length === 0);
  });
});
