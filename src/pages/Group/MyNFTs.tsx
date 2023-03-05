import React from 'react';
import { observer, useLocalObservable } from 'mobx-react-lite';
import Loading from 'components/Loading';
import Tooltip from '@material-ui/core/Tooltip';
import { INFT } from 'apis/types';
import { useStore } from 'store';
import { ContractApi, TrxApi } from 'apis';
import { IProfile } from 'apis/types';
import base64 from 'utils/base64';
import { runInAction } from 'mobx';
import sleep from 'utils/sleep';
import { lang } from 'utils/lang';

interface IProps {
  groupName: string
}

export default observer((props: IProps) => {
  const { userStore, postStore, groupStore, confirmDialogStore, snackbarStore, commentStore } = useStore();
  const state = useLocalObservable(() => ({
    nfts: [] as INFT[],
    fetchedNFTs: false,
  }));

  React.useEffect(() => {
    (async () => {
      try {
        const [mainnet, contractAddress] = props.groupName.split('.');
        const nfts = await ContractApi.checkUserAddress({
          mainnet,
          contractAddress,
          userAddress: userStore.address
        });
        state.nfts = nfts;
      } catch (err) {
        console.log(err);
      }
      state.fetchedNFTs = true;
    })();
  }, []);

  const setAvatar = (avatar: string) => {
    confirmDialogStore.show({
      content: lang.AreYouSureToSetThisNFTAsAvatar,
      ok: async () => {
        try {
          confirmDialogStore.setLoading(true);
          const ret: any = await base64.getFromBlobUrl(avatar);
          const imageBase64 = ret.url;
          console.log(`[]:`, { imageBase64 });
          const res = await TrxApi.createActivity({
            type: "Create",
            object: {
              type: 'Profile',
              describes: {
                type: 'Person',
                id: userStore.address,
              },
              name: userStore.profile.name,
              image: [{
                type: 'Image',
                mediaType: base64.getMimeType(imageBase64),
                content: base64.getContent(imageBase64),
              } as any]
            }
          }, groupStore.defaultGroup.groupId);
          console.log(res)
          const profile: IProfile = {
            name: userStore.profile.name,
            avatar: imageBase64,
            groupId: groupStore.defaultGroup.groupId,
            userAddress: userStore.address
          };
          runInAction(() => {
            userStore.setProfile(profile);
            for (const post of [...postStore.posts, ...postStore.userPosts]) {
              if (post.userAddress === userStore.address) {
                post.extra.userProfile = profile;
              }
            }
            for (const comment of commentStore.comments) {
              if (comment.userAddress === userStore.address) {
                comment.extra.userProfile = profile;
              }
            }
          })
          confirmDialogStore.hide();
          await sleep(400);
          snackbarStore.show({
            message: lang.saved,
          });
        } catch (err) {
          console.log(err);
          snackbarStore.show({
            message: lang.somethingWrong,
          });
          confirmDialogStore.setLoading(false);
        }
      },
    });
  }

  return (
    <div className="flex items-center absolute bottom-0 left-[80px]">
      {!state.fetchedNFTs && <div className="mt-[-28px]"><Loading size={12} /></div>}
      {state.fetchedNFTs && state.nfts.length === 0 && (
        <div className="mt-[-28px]">
          <div className="bg-[#e3e5e6] bg-opacity-60 dark:bg-opacity-10 text-12 py-[2px] px-2 flex items-center rounded-full">
            <span className="text-[#37434D] opacity-[0.6] font-bold dark:text-white dark:opacity-50">{lang.youDoNotHaveThisNFT}</span>
          </div>
        </div>
      )}
      {state.fetchedNFTs && state.nfts.map(nft => (
        <div key={nft.tokenId} className="mr-3" onClick={() => setAvatar(nft.image)}>
          <Tooltip
            enterDelay={200}
            enterNextDelay={200}
            placement="top"
            title={lang.setThisNFTAsAvatar}
            arrow
            >
            <img className="cursor-pointer w-[28px] h-[28px] rounded-6" src={nft.image} alt={`${nft.tokenId}`} />
          </Tooltip>
        </div>
      ))}
    </div>
  )
})