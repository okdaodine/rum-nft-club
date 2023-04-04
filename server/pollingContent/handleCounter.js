const UniqueCounter = require('../database/uniqueCounter');
const Post = require('../database/post');
const Comment = require('../database/comment');
const Notification = require('../database/notification');
const rumSDK = require('rum-sdk-nodejs');
const { trySendSocket } = require('../socket');
const Orphan = require('../database/sequelize/orphan');
const within24Hours = require('../utils/within24Hours');

module.exports = async (item, group) => {
  const counter = await pack(item);

  if (!counter) {
    const { Data: { type, object } } = item;
    const id = type === 'Undo' ? object.object.id : object.id;
    await Orphan.create({
      content: item,
      groupId: item.GroupId,
      parentId: `${id}`
    });
    throw new Error('Orphan');
  }

  const { objectId, value, name, timestamp } = counter;
  const from = counter.userAddress;
  const uniqueCounter = {
    name,
    objectId,
    userAddress: from
  };
  if (value > 0) {
    await UniqueCounter.upsert(uniqueCounter);
  } else if (value < 0) {
    await UniqueCounter.destroy(uniqueCounter);
  }

  if (name === UniqueCounter.CounterName.postLike) {
    const post = await Post.get(objectId);
    if (post) {
      const count = await UniqueCounter.count({
        where: {
          name,
          objectId: post.id
        }
      });
      post.likeCount = count;
      await Post.update(post.id, post);
      if (value > 0 && from !== post.userAddress) {
        const notification = {
          groupId: '',
          status: group.loaded && within24Hours(timestamp) ? 'unread' : 'read',
          type: 'like',
          toObjectId: post.id,
          toObjectType: 'post',
          to: post.userAddress,
          from,
          fromObjectId: '',
          fromObjectType: '',
          timestamp
        };
        await Notification.create(notification);
        if (group.loaded) {
          trySendSocket(notification.to, 'notification', notification);
        }
      }
    }
  }

  if (name === UniqueCounter.CounterName.commentLike) {
    const comment = await Comment.get(objectId);
    if (comment) {
      const count = await UniqueCounter.count({
        where: {
          name,
          objectId: comment.id
        }
      });
      comment.likeCount = count;
      await Comment.update(comment.id, comment);
      if (value > 0 && from !== comment.userAddress) {
        const notification = {
          groupId: '',
          status: group.loaded && within24Hours(timestamp) ? 'unread' : 'read',
          type: 'like',
          toObjectId: comment.id,
          toObjectType: 'comment',
          to: comment.userAddress,
          from,
          fromObjectId: '',
          fromObjectType: '',
          timestamp
        };
        await Notification.create(notification);
        if (group.loaded) {
          trySendSocket(notification.to, 'notification', notification);
        }
      }
    }
  }
}

const pack = async (item) => {
  const {
    TrxId,
    Data: {
      type,
      object,
      published,
    },
    SenderPubkey,
    GroupId,
    TimeStamp,
  } = item;
  const id = type === 'Undo' ? object.object.id : object.id;
  const data = {
    objectId: id,
    value: type === 'Undo' ? -1 : 1,
    name: '',
    userAddress: rumSDK.utils.pubkeyToAddress(SenderPubkey),
    groupId: GroupId,
    trxId: TrxId,
    timestamp: published ? new Date(published).getTime() : parseInt(TimeStamp.slice(0, 13)),
  }
  const post = await Post.get(id);
  const comment = await Comment.get(id);
  if (post) {
    data.name = UniqueCounter.CounterName.postLike;
  } else if (comment) {
    data.name = UniqueCounter.CounterName.commentLike;
  } else {
    return null;
  }
  return data;
}