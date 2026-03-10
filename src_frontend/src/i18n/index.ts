import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';

// 自定义语言检测：中文用户默认中文，其他默认英文
const customDetector = {
  name: 'customNavigator',
  lookup() {
    // 检查浏览器语言
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    // 中文用户（zh, zh-CN, zh-TW, zh-HK）返回中文
    if (lang.toLowerCase().startsWith('zh')) {
      return 'zh';
    }
    // 其他用户返回英文
    return 'en';
  },
  cacheUserLanguage(lng: string) {
    localStorage.setItem('i18nextLng', lng);
  }
};

// 添加自定义检测器
const languageDetector = new LanguageDetector();
languageDetector.addDetector(customDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      // 优先使用 localStorage（用户手动选择），其次使用自定义检测
      order: ['localStorage', 'customNavigator'],
      caches: ['localStorage']
    }
  });

export default i18n;