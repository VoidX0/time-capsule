import messages from './messages/en.json'

/* 提供翻译信息补全 */
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof messages
  }
}
