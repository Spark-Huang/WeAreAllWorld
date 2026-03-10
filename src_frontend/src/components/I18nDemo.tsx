import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * 国际化示例组件
 * 展示如何使用 i18n 进行多语言支持
 */
export function I18nDemo() {
  const { t } = useTranslation();

  return (
    <div className="p-4 space-y-4">
      {/* 语言切换 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('brand.name')}</h1>
        <LanguageSwitcher />
      </div>

      {/* 品牌标语 */}
      <p className="text-gray-600">{t('brand.tagline')}</p>

      {/* 导航示例 */}
      <nav className="flex gap-4">
        <span>{t('nav.home')}</span>
        <span>{t('nav.chat')}</span>
        <span>{t('nav.profile')}</span>
        <span>{t('nav.settings')}</span>
      </nav>

      {/* AI 状态示例 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h2 className="font-semibold">{t('ai.partner')}</h2>
        <p>{t('ai.status.active')}</p>
        <p>{t('ai.contribution')}: 100</p>
        <p>{t('ai.title.friend')}</p>
      </div>

      {/* 聊天示例 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">{t('chat.noMessages')}</p>
        <input 
          type="text" 
          placeholder={t('chat.placeholder')} 
          className="border rounded px-3 py-2 w-full"
        />
        <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
          {t('chat.send')}
        </button>
      </div>

      {/* 签到示例 */}
      <div className="p-4 bg-green-50 rounded-lg">
        <h3 className="font-semibold">{t('checkin.title')}</h3>
        <button className="mt-2 px-4 py-2 bg-green-500 text-white rounded">
          {t('checkin.checkin')}
        </button>
      </div>
    </div>
  );
}
