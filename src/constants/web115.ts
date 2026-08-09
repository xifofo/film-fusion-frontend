export const DEFAULT_WEB115_RELOGIN_APP: API.Web115ReloginApp = 'alipaymini';
export const WEB115_USE_DEFAULT_APP = 'default';

export const WEB115_RELOGIN_APP_OPTIONS = [
  { label: 'alipaymini（115生活・支付宝小程序，推荐）', value: 'alipaymini' },
  { label: 'wechatmini（115生活・微信小程序）', value: 'wechatmini' },
  { label: 'tv（115生活・安卓电视端）', value: 'tv' },
  { label: 'qandroid（115管理・安卓端）', value: 'qandroid' },
  { label: 'web（115生活・网页端）', value: 'web' },
  { label: 'android（115生活・安卓端）', value: 'android' },
  { label: 'ios（115生活・苹果端）', value: 'ios' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: API.Web115ReloginApp;
}>;
