# Requirements Document

## Introduction

本功能为 SIGMA AI 创意工坊新增"一键白底图"功能模块。该功能允许用户上传产品图片，自动生成产品的白底图（电商常用），支持用户选择是否去除产品表面光影反射。同时，系统需要记录用户生成图片的数量（为后续付费功能做准备），并在界面上展示免责声明和联系方式。

## Glossary

- **White_Background_Generator**: 一键白底图生成系统，负责将用户上传的产品图片转换为白色背景的产品图
- **Generation_Counter**: 图片生成计数器，记录用户已生成的付费图片数量
- **Shadow_Removal_Option**: 光影去除选项，用户可选择是否去除产品表面的光影反射
- **Disclaimer_Modal**: 免责声明弹窗，展示软件使用说明和生图内容免责声明
- **Contact_Modal**: 联系我们弹窗，展示联系人手机号和微信二维码

## Requirements

### Requirement 1

**User Story:** As a 电商用户, I want to 一键生成产品白底图, so that 我可以快速获得符合电商平台要求的产品展示图。

#### Acceptance Criteria

1. WHEN 用户点击侧边栏的"一键白底图"按钮 THEN the White_Background_Generator SHALL 导航到白底图生成页面
2. WHEN 白底图页面加载完成 THEN the White_Background_Generator SHALL 在左侧显示图片上传区域，在右侧显示输出预览区域
3. WHEN 用户上传产品图片 THEN the White_Background_Generator SHALL 在左侧区域显示已上传的图片预览
4. WHEN 用户点击生成按钮 THEN the White_Background_Generator SHALL 弹出光影选项对话框询问用户是否去除产品表面光影反射
5. WHEN 用户选择光影选项并确认 THEN the White_Background_Generator SHALL 构造包含用户选择的提示词并调用生成接口
6. WHEN 图片生成过程中 THEN the White_Background_Generator SHALL 在右侧输出区域显示与主页相同的生成动画效果
7. WHEN 图片生成完成 THEN the White_Background_Generator SHALL 在右侧输出区域显示生成的白底图

### Requirement 2

**User Story:** As a 用户, I want to 查看白底图生成历史记录, so that 我可以回顾和复用之前生成的白底图。

#### Acceptance Criteria

1. WHEN 白底图页面加载完成 THEN the White_Background_Generator SHALL 在页面底部或侧边显示该功能的历史生成记录
2. WHEN 白底图生成成功 THEN the White_Background_Generator SHALL 将生成记录保存到历史记录中，并标记为白底图类型
3. WHEN 用户点击历史记录中的白底图 THEN the White_Background_Generator SHALL 在右侧输出区域显示该图片

### Requirement 3

**User Story:** As a 系统管理员, I want to 记录用户生成图片的数量, so that 我可以为后续的付费功能做数据准备。

#### Acceptance Criteria

1. WHEN 用户成功生成一张付费类型的图片（创作空间或白底图） THEN the Generation_Counter SHALL 将用户的生成计数加一
2. WHEN 页面加载完成 THEN the Generation_Counter SHALL 在右上角显示用户已生成的图片总数
3. WHEN 生成计数更新 THEN the Generation_Counter SHALL 实时刷新右上角的显示数字

### Requirement 4

**User Story:** As a 用户, I want to 查看软件免责声明, so that 我可以了解软件使用条款和生图内容的法律责任。

#### Acceptance Criteria

1. WHEN 用户点击左下角的"免责声明"按钮 THEN the Disclaimer_Modal SHALL 显示包含软件使用说明的弹窗
2. WHEN 免责声明弹窗显示 THEN the Disclaimer_Modal SHALL 包含一般软件使用说明内容
3. WHEN 免责声明弹窗显示 THEN the Disclaimer_Modal SHALL 包含 AI 生图内容免责说明
4. WHEN 用户点击弹窗外部或关闭按钮 THEN the Disclaimer_Modal SHALL 关闭弹窗

### Requirement 5

**User Story:** As a 用户, I want to 查看联系方式, so that 我可以在需要时联系软件提供方。

#### Acceptance Criteria

1. WHEN 用户点击左下角的"联系我们"按钮 THEN the Contact_Modal SHALL 显示联系方式弹窗
2. WHEN 联系方式弹窗显示 THEN the Contact_Modal SHALL 显示联系人手机号
3. WHEN 联系方式弹窗显示 THEN the Contact_Modal SHALL 显示微信二维码图片
4. WHEN 用户点击弹窗外部或关闭按钮 THEN the Contact_Modal SHALL 关闭弹窗

### Requirement 6

**User Story:** As a 开发者, I want to 提示词按用户选择动态构造, so that 生成的白底图符合用户对光影的偏好。

#### Acceptance Criteria

1. WHEN 用户选择保留光影 THEN the White_Background_Generator SHALL 构造提示词为"不要修改图中的产品和位置，生成产品的白底图"
2. WHEN 用户选择去除光影 THEN the White_Background_Generator SHALL 构造提示词为"不要修改图中的产品和位置，生成产品的白底图，去掉产品表面所有光影反射"
