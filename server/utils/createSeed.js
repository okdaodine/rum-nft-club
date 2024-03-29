const rumSDK = require('rum-sdk-nodejs');
const { assert, Errors } = require('./validator');
const Group = require('../database/sequelize/group');
const Seed = require('../database/sequelize/seed');
const Contract = require('./contract');

module.exports = async (url) => {
  const existGroup = await Seed.findOne({
    where: {
      url
    }
  });
  assert(!existGroup, Errors.ERR_IS_DUPLICATED('url'));
  const { groupId, chainAPIs, groupName } = rumSDK.utils.seedUrlToGroup(url);
  assert(chainAPIs.length > 0, Errors.ERR_IS_REQUIRED('chainAPIs'));
  await Seed.create({
    url,
    groupId,
    groupName,
  });
  const seeds = await Seed.findAll({
    where: {
      groupId
    }
  });
  const baseSeedUrl = seeds[0].url.split('&u=')[0];
  const apiMap = {};
  for (const seed of seeds) {
    const group = rumSDK.utils.seedUrlToGroup(seed.url);
    for (const api of group.chainAPIs) {
      const origin = new URL(api).origin;
      apiMap[origin] = api;
    }
  }
  const combinedSeedUrl = `${baseSeedUrl}&u=${Object.values(apiMap).join('|')}`;
  const group = await Group.findOne({
    where: {
      groupId
    }
  });
  if (group) {
    await Group.update({
      seedUrl: combinedSeedUrl
    }, {
      where: {
        groupId
      }
    });
  } else {
    let groupAlias = groupName;
    const [mainnet, contractAddress] = groupName.split('.');
    if (mainnet && contractAddress) {
      groupAlias = await Contract.getContractName(mainnet, contractAddress);
    }
    await Group.create({
      seedUrl: combinedSeedUrl,
      groupId,
      groupName,
      groupAlias,
      startTrx: '',
      status: 'connected',
      loaded: false,
      contentCount: 0
    });
  }
  rumSDK.cache.Group.remove(groupId);
  rumSDK.cache.Group.add(combinedSeedUrl);
  return groupId;
}
