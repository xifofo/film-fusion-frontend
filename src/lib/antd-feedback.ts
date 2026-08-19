import { App } from 'antd';
import { useLayoutEffect } from 'react';

type MessageInstance = ReturnType<typeof App.useApp>['message'];

let activeMessage: MessageInstance | undefined;
const pendingErrors: string[] = [];

export const showApiError = (content: string) => {
  if (activeMessage) {
    void activeMessage.error(content);
    return;
  }

  pendingErrors.push(content);
};

export function AntdFeedbackBridge() {
  const { message } = App.useApp();

  useLayoutEffect(() => {
    activeMessage = message;
    for (const content of pendingErrors.splice(0)) {
      void message.error(content);
    }

    return () => {
      if (activeMessage === message) {
        activeMessage = undefined;
      }
    };
  }, [message]);

  return null;
}
