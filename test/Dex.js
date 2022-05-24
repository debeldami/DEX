const Dai = artifacts.require('mocks/Dai.sol');
const Rep = artifacts.require('mocks/Rep.sol');
const Bat = artifacts.require('mocks/Bat.sol');
const Zrx = artifacts.require('mocks/Zrx.sol');

contract('Dex', () => {
  let dai, rep, bat, zrx;

  beforeEach(async () => {
    [dai, rep, bat, zrx] = await Promise.all([
      Dai.new(),
      Rep.new(),
      Bat.new(),
      Zrx.new(),
    ]);
  });
});
