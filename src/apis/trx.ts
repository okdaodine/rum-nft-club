import request from 'request';
import { API_BASE_URL } from './common';
import { IActivity, ITrx, utils } from 'rum-sdk-browser';
import { Store } from 'store';

export default {
  async createActivity(activity: IActivity, groupId: string, privateKey?: string) {
    console.log(activity, groupId)
    const { groupStore, userStore } = (window as any).store as Store;
    const group = groupStore.map[groupId];

    activity.published = new Date().toISOString();

    const payload = await utils.signTrx({
      data: activity,
      groupId: group.groupId,
      aesKey: group.extra.rawGroup.cipherKey,
      privateKey: privateKey || userStore.privateKey,
    });
    console.log(payload);
    const res: { trx_id: string } = await request(`${API_BASE_URL}/${groupId}/trx`, {
      method: 'POST',
      body: payload
    });
    return res;
  },

  async get(groupId: string, trxId: string) {
    const res: ITrx = await request(`${API_BASE_URL}/${groupId}/trx/${trxId}`);
    return res;
  }
}
