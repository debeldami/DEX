const expectRevert = require('@openzeppelin/test-helpers/src/expectRevert');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

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

    const buyOrder = await dex.getOrders(BAT, SIDE.BUY);
    const sellOrder = await dex.getOrders(BAT, SIDE.SELL);

    assert(buyOrder.length === 1);
    assert(buyOrder[0].trader === trader1);
    assert(buyOrder[0].ticker === web3.utils.padRight(BAT, 64));
    assert(buyOrder[0].price === '10');
    assert(buyOrder[0].amount === web3.utils.toWei('10'));
    assert(sellOrder.length === 0);
  });
});
