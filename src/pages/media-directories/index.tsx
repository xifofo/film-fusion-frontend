/** 旧版入口转到唯一的媒体目录编辑器，旧收藏地址仍可打开。 */
import { useEffect } from 'react';

export default function MediaDirectories() {
  const origin = import.meta.env.DEV
    ? 'http://127.0.0.1:8001'
    : window.location.origin;
  const target = `${origin}/v2/media-directories`;

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return <a href={target}>媒体目录 / Media directories</a>;
}
