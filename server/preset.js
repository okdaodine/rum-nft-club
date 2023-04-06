const { RumFullNodeClient } = require('rum-fullnode-sdk');
const Group = require('./database/sequelize/group');
const config = require('./config');
const createSeed = require('./utils/createSeed');
const sleep = require('./utils/sleep');

module.exports = async () => {
  await sleep(3000);
  await tryCreateDefaultGroup();
}

async function tryCreateDefaultGroup () {
  const defaultGroup = await Group.findOne({ where: { groupName: 'default' } });
  if (!defaultGroup) {
    try {
      let seed = '';
      if (config.defaultGroupSeed) {
        seed = config.defaultGroupSeed;
      } else {
        const client = RumFullNodeClient(config.fullnode);
        const res = await client.Group.create({
          group_name: 'default',
          consensus_type: 'poa',
          encryption_type: 'public',
          app_key: 'group_timeline',
          include_chain_url: true,
        });
        seed = res.seed;
      }
      const groupId = await createSeed(seed);
      console.log(`Create default group ${groupId} ✅`);
    } catch (err) {
      console.log(err);
    }
  }
}