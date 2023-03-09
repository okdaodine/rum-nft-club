const rumSDK = require('rum-sdk-nodejs');
const Post = require('../database/post');
const NFT = require('../database/sequelize/nft');
const Wallet = require('../database/sequelize/wallet');
const { getSocketIo } = require('../socket');
const config = require('../config');
const Mixin = require('../mixin');
const truncateByBytes = require('../utils/truncateByBytes');
const within24Hours = require('../utils/within24Hours');
const Contract = require('../utils/contract');

module.exports = async (item, group) => {
  const post = await pack(item);
  const [mainnet, contractAddress] = group.groupName.split('.');
  if (!mainnet || !contractAddress) {
    return;
  }
  const wallet = await Wallet.findOne({ where: { address: post.userAddress }});
  const userAddress = wallet ? wallet.providerAddress : post.userAddress;
  const existNFT = await NFT.findOne({ where: { mainnet, contractAddress, userAddress } });
  if (!existNFT) {
    const count = await Contract.getNFTCount(mainnet, contractAddress, userAddress);
    if (count > 0) {
      const nfts = await Contract.getNFTs(mainnet, contractAddress, userAddress, count);
      for (const nft of nfts) {
        const exist = await NFT.findOne({ where: { mainnet, contractAddress, userAddress, tokenId: nft.tokenId } })
        if (!exist) {
          await NFT.create(nft);
        }
      }
      console.log(`Got and saved ${count} NFTs`);
    } else {
      console.log('[Handle post]: Could not found NFT then skip it 🤷‍♂️');
      return;
    }
  }
  if (!post.id) {
    return;
  }
  const exist = await Post.get(post.id);
  if (exist) {
    return;
  }
  await Post.create(post);
  if (group.loaded) {
    await notify(post.id);
  }
}

const pack = async item => {
  const {
    TrxId,
    Data: {
      object: {
        id,
        name,
        content,
        image,
      }
    },
    SenderPubkey,
    TimeStamp,
  } = item;
  const post = {
    content,
    title: name || '',
    userAddress: rumSDK.utils.pubkeyToAddress(SenderPubkey),
    groupId: item.GroupId,
    trxId: TrxId,
    id,
    latestTrxId: '',
    storage: 'chain',
    commentCount: 0,
    likeCount: 0,
    timestamp: parseInt(String(TimeStamp / 1000000), 10)
  }
  if (image && Array.isArray(image)) {
    post.images = image;
    post.imageCount = image.length;
  }
  return post
}

const notify = async (id) => {
  const post = await Post.get(id, {
    withReplacedImage: true,
    withExtra: true
  });
  if (post) {
    if (within24Hours(post.timestamp)) {  
      getSocketIo().emit('post', post);
      const name = post.extra.userProfile.name.split('\n')[0];
      Mixin.notifyByBot({
        iconUrl: post.extra.userProfile.avatar,
        title: (post.content || '').slice(0, 30) || 'Image',
        description: truncateByBytes(name, 14),
        url: `${config.origin}/posts/${post.id}`
      });
    }
  }
}
