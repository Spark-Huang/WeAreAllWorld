# assets - 美术资源

大同世界美术资源文件。

## 目录结构

```
assets/
├── images/             # 图片资源
├── icons/              # 图标
└── illustrations/      # 插画
```

## 资源类型

- AI 伙伴头像
- 剧情插图
- UI 图标
- 背景图片

## 使用

资源通过相对路径引用：

```tsx
import avatar from '@/assets/images/avatar.png'
```

## 注意

- 图片使用 WebP 格式优化体积
- SVG 图标放入 `icons/` 目录
- 大型资源考虑使用 CDN