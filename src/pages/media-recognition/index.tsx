/** 媒体识别统一使用 medianame；识别词在解析前应用。 */

import { App, Button, Input, Tabs } from 'antd';
import { RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  getMediaRecognitionWords,
  saveMediaRecognitionWords,
} from '@/services/film-fusion';

import MedianameWorkbench from './MedianameWorkbench';
import { splitRecognitionWords } from './rules';

/** 配置分类和命名模板，或编辑 medianame 共用的识别词。 */
export default function MediaRecognitionPage() {
  return (
    <div className="space-y-5 p-5">
      <h1 className="text-xl font-semibold">媒体识别</h1>
      <Tabs
        items={[
          {
            key: 'medianame',
            label: 'medianame',
            children: <MedianameWorkbench />,
          },
          { key: 'words', label: '识别词', children: <RecognitionWords /> },
        ]}
      />
    </div>
  );
}

function RecognitionWords() {
  const { message } = App.useApp();
  const [words, setWords] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMediaRecognitionWords()
      .then((response) => {
        if (!active) return;
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '读取识别词失败');
        setWords(response.data.words.join('\n'));
      })
      .catch((error: unknown) => {
        if (active)
          void message.error(
            error instanceof Error ? error.message : '读取识别词失败',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [message, reload]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await saveMediaRecognitionWords(
        splitRecognitionWords(words),
      );
      if (response.code !== 0 || !response.data)
        throw new Error(response.message || '保存识别词失败');
      setWords(response.data.words.join('\n'));
      void message.success('识别词已保存');
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : '保存识别词失败',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p>识别词在 medianame 解析前按顺序应用，每行一条规则。</p>
      <Input.TextArea
        aria-label="识别词"
        value={words}
        onChange={(event) => setWords(event.target.value)}
        rows={14}
        disabled={loading || saving}
      />
      <div className="flex gap-2">
        <Button
          icon={<RefreshCw size="1em" />}
          loading={loading}
          disabled={saving}
          onClick={() => setReload((value) => value + 1)}
        >
          重新载入
        </Button>
        <Button
          type="primary"
          icon={<Save size="1em" />}
          loading={saving}
          disabled={loading}
          onClick={() => void save()}
        >
          保存识别词
        </Button>
      </div>
    </div>
  );
}
