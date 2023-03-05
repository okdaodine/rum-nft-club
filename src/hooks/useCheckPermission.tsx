import React from 'react';
import { Store } from 'store';
import { ContractApi } from 'apis';
import { lang } from 'utils/lang';

export default (store: Store) => {
  const { snackbarStore, userStore } = store;

  return React.useCallback(async (groupName: string) => {
    const [mainnet, contractAddress] = groupName.split('.');
    try {
      const nfts = await ContractApi.checkUserAddress({
        mainnet,
        contractAddress,
        userAddress: userStore.address
      });
      console.log({ nfts });
      if (nfts.length === 0) {
        snackbarStore.show({
          message: lang.youDoNotHaveNFTSoYouCannotPostContent,
          type: 'error',
          duration: 3000
        });
        return false;
      }
      return true;
    } catch (err: any) {
      console.log(err);
      snackbarStore.show({
        message: err.message,
        type: 'error',
      });
    }
    return false;
  }, []);
}