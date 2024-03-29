const router = require('koa-router')();
const config = require('../config');
const Group = require('../database/sequelize/group');
const Wallet = require('../database/sequelize/wallet');
const NFT = require('../database/sequelize/nft');
const { RumFullNodeClient } = require('rum-fullnode-sdk');
const createSeed = require('../utils/createSeed');
const Contract = require('../utils/contract');
const { assert, Errors } = require('../utils/validator');

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
    assert(Contract.RPC_MAPPING[mainnet], Errors.ERR_IS_INVALID('mainnet'));
    const client = RumFullNodeClient(config.fullnode);
    {
      const res = await client.Group.create({
        group_name: groupName,
        consensus_type: 'poa',
        encryption_type: 'public',
        app_key: 'group_timeline',
        include_chain_url: true,
      });
      console.log(res);
      await createSeed(res.seed);
    }
  }
  ctx.body = { groupName };
}

async function checkUserAddress(ctx) {
  const { mainnet, contractAddress } = ctx.params;
  const groupName = `${mainnet}.${contractAddress}`;
  const group = await Group.findOne({ where: { groupName }});
  assert(group, Errors.ERR_NOT_FOUND('group'));
  const wallet = await Wallet.findOne({ where: { address: ctx.params.userAddress }});
  const userAddress = wallet ? wallet.providerAddress : ctx.params.userAddress;
  const nfts = await NFT.findAll({ where: { mainnet, contractAddress, userAddress }});
  if (nfts.length > 0) {
    ctx.body = nfts;
    return;
  }
  const count = await Contract.getNFTCount(mainnet, contractAddress, userAddress);
  if (count > 0) {
    const nfts = await Contract.getNFTs(mainnet, contractAddress, userAddress, count);
    for (const nft of nfts) {
      const exist = await NFT.findOne({ where: { mainnet, contractAddress, userAddress, tokenId: nft.tokenId } })
      if (!exist) {
        await NFT.create(nft);
      }
    }
    ctx.body = nfts;
  } else {
    ctx.body = [];
  }
}

module.exports = router;