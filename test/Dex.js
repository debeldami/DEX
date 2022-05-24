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
      dai.addToken(DAI, dai.address),
      rep.addToken(REP, dai.address),
      bat.addToken(BAT, dai.address),
      zrx.addToken(ZRX, dai.address),
    ]);

    const amount = web3.utils.toWei('1000');

    const seedTokenBalnce = async (token, trader) => {
      await token._mint(trader, amount);
      await token.approve(dex.address, amount, {
        from: trader,
      });

      await Promise.all(
        [dai, rep, bat, zrx].map((token) => seedTokenBalnce(token, trader1))
      );

      await Promise.all(
        [dai, rep, bat, zrx].map((token) => seedTokenBalnce(token, trader2))
      );
    };
  });
});
