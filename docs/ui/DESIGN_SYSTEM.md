# 设计规范文档

Focus 使用 TailwindCSS 4.x 作为样式框架，定义了统一的设计语言。

## 颜色系统

### 主色调

| 名称 | 色值 | 用途 |
|------|------|------|
| 品牌红 | `red-600` (#dc2626) | 主按钮、Logo、高亮 |
| 品牌红浅 | `red-50` (#fef2f2) | 选中背景、hover 状态 |
| 品牌红深 | `red-700` (#b91c1c) | 按钮 hover |

### 中性色

| 名称 | 色值 | 用途 |
|------|------|------|
| 背景色 | `#fafafa` | 页面背景 |
| 卡片背景 | `white` | 卡片、面板 |
| 边框色 | `gray-100` (#f3f4f6) | 分割线、边框 |
| 文字主色 | `gray-800` (#1f2937) | 主要文字 |
| 文字次色 | `gray-600` (#4b5563) | 次要文字 |
| 文字弱色 | `gray-400` (#9ca3af) | 占位符、禁用 |

### 功能色

| 名称 | 色值 | 用途 |
|------|------|------|
| 成功 | `green-600` (#16a34a) | 成功状态、已完成 |
| 警告 | `amber-600` (#d97706) | 警告提示 |
| 错误 | `red-600` (#dc2626) | 错误状态 |
| 信息 | `blue-600` (#2563eb) | 信息提示 |

### 状态指示灯

```tsx
// 绿色 - 正常
<div className="w-2 h-2 rounded-full bg-green-500" />

// 黄色 - 警告
<div className="w-2 h-2 rounded-full bg-yellow-500" />

// 红色 - 错误
<div className="w-2 h-2 rounded-full bg-red-500" />
```

## 字体规范

### 字体族

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### 字号

| 名称 | 类名 | 大小 | 用途 |
|------|------|------|------|
| 超小 | `text-[9px]` | 9px | 侧边栏标签 |
| 极小 | `text-[10px]` | 10px | 侧边栏导航文字 |
| 小 | `text-xs` | 12px | 辅助文字、标签 |
| 正常 | `text-sm` | 14px | 正文、按钮 |
| 中等 | `text-base` | 16px | 标题 |
| 大 | `text-lg` | 18px | 页面标题 |

### 字重

| 名称 | 类名 | 用途 |
|------|------|------|
| 正常 | `font-normal` | 正文 |
| 中等 | `font-medium` | 标签、导航 |
| 半粗 | `font-semibold` | 小标题 |
| 粗体 | `font-bold` | 大标题 |

## 间距系统

### 基础间距

| 名称 | 值 | 用途 |
|------|------|------|
| 1 | 4px | 最小间距 |
| 2 | 8px | 紧凑间距 |
| 3 | 12px | 小间距 |
| 4 | 16px | 标准间距 |
| 6 | 24px | 中等间距 |
| 8 | 32px | 大间距 |

### 常用组合

```tsx
// 卡片内边距
<div className="p-6">

// 按钮内边距
<button className="px-4 py-2">

// 列表项间距
<div className="space-y-4">

// 网格间距
<div className="gap-6">
```

## 圆角

| 名称 | 类名 | 值 | 用途 |
|------|------|------|------|
| 小 | `rounded` | 4px | 小元素 |
| 中 | `rounded-lg` | 8px | 按钮、输入框 |
| 大 | `rounded-xl` | 12px | 卡片 |
| 超大 | `rounded-2xl` | 16px | 大卡片、面板 |
| 圆形 | `rounded-full` | 50% | 头像、指示灯 |

## 阴影

| 名称 | 类名 | 用途 |
|------|------|------|
| 小 | `shadow-sm` | 卡片 |
| 中 | `shadow` | 弹窗 |
| 大 | `shadow-lg` | 下拉菜单 |
| 超大 | `shadow-xl` | 模态框 |

### 品牌阴影

```tsx
// Logo 阴影
<div className="shadow-lg shadow-red-200">

// 按钮阴影
<button className="shadow-md shadow-red-200">
```

## 组件样式

### 按钮

```tsx
// 主按钮
<button className="px-4 py-2 bg-red-600 text-white rounded-lg 
                   hover:bg-red-700 transition-colors">
  提交
</button>

// 次按钮
<button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg 
                   hover:bg-gray-200 transition-colors">
  取消
</button>

// 禁用状态
<button className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg 
                   cursor-not-allowed" disabled>
  禁用
</button>

// 加载状态（任务运行中）
<button className="px-4 py-2 bg-red-600 text-white rounded-lg 
                   opacity-50 cursor-not-allowed" disabled>
  <Loader2 className="w-4 h-4 animate-spin" />
</button>

// 重新生成按钮禁用状态
<button className="p-1.5 text-gray-300 cursor-not-allowed rounded-lg" 
        disabled title="请等待当前任务完成">
  <RotateCw className="w-3.5 h-3.5" />
</button>
```

### 输入框

```tsx
<input className="w-full px-4 py-2 border border-gray-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-red-500
                  placeholder:text-gray-400" />
```

### 卡片

```tsx
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
  {/* 卡片内容 */}
</div>
```

### 导航项

```tsx
// 激活状态
<button className="text-red-600 bg-red-50 border-r-2 border-red-600">

// 默认状态
<button className="text-gray-400 hover:text-red-500 hover:bg-gray-50">
```

## 图标

使用 Lucide React 图标库。

### 常用图标

| 图标 | 组件 | 用途 |
|------|------|------|
| ✨ | `Sparkles` | Logo |
| ✏️ | `PenTool` | 创作 |
| 🛒 | `ShoppingBag` | 电商 |
| 📜 | `History` | 历史 |
| ⚙️ | `Settings` | 设置 |
| 🛡️ | `Shield` | 免责 |
| 💬 | `MessageCircle` | 联系 |
| ⭐ | `Star` | 升级 |

### 图标尺寸

```tsx
// 侧边栏图标
<Icon className="w-6 h-6" />

// 按钮图标
<Icon className="w-5 h-5" />

// 小图标
<Icon className="w-4 h-4" />
```

## 过渡动画

### 标准过渡

```tsx
// 颜色过渡
<div className="transition-colors">

// 所有属性过渡
<div className="transition-all">

// 变换过渡
<div className="transition-transform">
```

### 持续时间

```tsx
// 快速 (150ms)
<div className="duration-150">

// 标准 (300ms)
<div className="duration-300">

// 慢速 (500ms)
<div className="duration-500">
```

## 响应式设计

### 断点使用

```tsx
// 移动优先
<div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// 隐藏/显示
<div className="hidden lg:block">
<div className="block lg:hidden">
```

### 最大宽度

```tsx
// 内容区最大宽度
<div className="max-w-3xl mx-auto">  // 创作页面
<div className="max-w-6xl mx-auto">  // 电商页面
```

## 设计原则

### 1. 简洁清晰

- 减少视觉噪音
- 突出核心功能
- 使用充足的留白

### 2. 一致性

- 统一的颜色系统
- 统一的间距规则
- 统一的交互模式

### 3. 反馈及时

- 按钮 hover 状态
- 加载状态指示
- 操作结果提示

### 4. 可访问性

- 足够的颜色对比度
- 清晰的焦点状态
- 合理的点击区域
