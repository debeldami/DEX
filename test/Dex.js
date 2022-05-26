const expectRevert = require('@openzeppelin/test-helpers/src/expectRevert');

const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');
const Dex = artifacts.require('Dex');

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

  it('should not deposit tokens', async () => {
    const amount = web3.utils.toWei('1000');

    await expectRevert(() => {
      dex.deposit(
        amount,
        ZRX,
        {
          from: trader1,
        },
        'token does not exist'
      );
    });
  });
});
