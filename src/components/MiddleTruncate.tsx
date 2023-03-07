import Tooltip from '@material-ui/core/Tooltip';
import copy from 'copy-to-clipboard';
import { observer } from 'mobx-react-lite';
import { useStore } from 'store';
import { lang } from 'utils/lang';

interface IProps {
  string: string
  length: number
  tooltipPrefix?: string
}

export default observer((props: IProps) => {
  const { snackbarStore } = useStore();
  const { string, length, tooltipPrefix = '' } = props;

  if (!string) {
    return null;
  }

  return (
    <div onClick={() => {
      copy(string);
      snackbarStore.show({
        message: lang.copied,
      });
    }}
    >
      <Tooltip
        placement="top"
        title={`${tooltipPrefix}${string}`}
        arrow
        interactive
        enterDelay={400}
        enterNextDelay={400}
      >
        <div className="truncate">{`${string.slice(
          0,
          length,
        )}...${string.slice(-length)}`}</div>
      </Tooltip>
    </div>
  );
});
