const router = require('koa-router')();
const config = require('../config');
const Group = require('../database/sequelize/group');
const Wallet = require('../database/sequelize/wallet');
const NFT = require('../database/sequelize/nft');
const { RumFullNodeClient } = require('rum-fullnode-sdk');
const createSeed = require('../utils/createSeed');
const Contract = require('../utils/contract');
const { assert, Errors, throws } = require('../utils/validator');

router.post('/:mainnet/:contractAddress', checkGroup);
router.post('/:mainnet/:contractAddress/:userAddress', checkUserAddress);

async function checkGroup(ctx) {
  const { mainnet, contractAddress } = ctx.params;
  const groupName = `${mainnet}.${contractAddress}`;
  console.log(groupName);
  const group = await Group.findOne({
    where: {
      groupName
    }
  });
  console.log(group);
  if (!group) {
    const contractName = await Contract.getContractName(mainnet, contractAddress);
    const client = RumFullNodeClient(config.fullnode);
    {
      const res = await client.Group.create({
        group_name: groupName,
        consensus_type: 'poa',
        encryption_type: 'public',
        app_key: 'group_timeline',
      });
      console.log(res);
      await createSeed(res.seed);
      await Group.update({
        groupAlias: contractName || groupName
      }, {
        where: {
          groupId: res.group_id
        }
      });
    }
  }
  ctx.body = { groupName };
}

async function checkUserAddress(ctx) {
  const { mainnet, contractAddress, userAddress } = ctx.params;
  const groupName = `${mainnet}.${contractAddress}`;
  const group = await Group.findOne({ where: { groupName }});
  assert(group, Errors.ERR_NOT_FOUND('group'));
  const wallet = await Wallet.findOne({ where: { address: userAddress }});
  assert(wallet, Errors.ERR_NOT_FOUND('wallet'));
  const nft = await NFT.findOne({ where: { mainnet, contractAddress, userAddress }});
  if (nft) {
    ctx.body = true;
    return;
  }
  const count = await Contract.getNFT(mainnet, contractAddress, wallet.providerAddress);
  if (count > 0) {
    await NFT.create({ mainnet, contractAddress, userAddress, count });
  } else {
    throws(Errors.ERR_NOT_FOUND('NFT'));
  }
  ctx.body = true;
}

module.exports = router;