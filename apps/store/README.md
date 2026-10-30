# 《度日：Daydrift》模组工坊商店 (@daydrift/store)

> 线上访问地址：[daydrift-mods.blym.top](https://daydrift-mods.blym.top)

本子项目为《度日：Daydrift》的官方模组工坊商店前端，基于 Astro 5 构建，提供模组浏览、在线搜索过滤、深链接唤醒安装（`daydrift://install`）、Ed25519 签名状态校验查询、社区模组提审指引与公钥透明度公示。

---

## 页面架构与路由映射

| 路由路径 | 对应源文件 | 核心职责 |
| :--- | :--- | :--- |
| `/` | `src/pages/index.astro` | 商店首页：官方精选、社区生态、按体系过滤、一键深链接安装 |
| `/mod/[id]` | `src/pages/mod/[id].astro` | 模组详情页：作者信息、详细文档、权限清单、Ed25519 签名卡片、智能深链接拉起 |
| `/beta` | `src/pages/beta.astro` | 先行测试区：展示 Beta 渠道公钥签发的先行体验版模组 |
| `/submit` | `src/pages/submit.astro` | 模组提审中心：在线 Manifest 构造工具、静态合规自检与 GitHub 投稿通道 |
| `/review` | `src/pages/review.astro` | 维护者审查手册：审核指令说明、CI 签名触发步骤 |
| `/keys` | `src/pages/keys.astro` | 公钥透明度公示：列出所有受信任官方公钥与已吊销密钥指纹 |
| `/404` | `src/pages/404.astro` | 404 引导页 |

---

## 核心设计与深链接交互规范

1. **确定性元数据绑定**：
   - 页面中的所有模组信息严格来自根目录构建生成的 `catalog.json` 与 `index.json`，确保页面内容与分发包内容 100% 对齐。
2. **智能深链接协议（Smart Deep-Link）**：
   - 协议格式：`daydrift://install?id=<mod_id>&url=<encoded_download_url>`；
   - 支持浏览器失焦探测：当玩家点击一键安装但未检测到本地客户端响应时，平滑弹出降级自愈抽屉，提供 `.ddmod` 直接下载与一键注册协议指导。
3. **密码学证书展示**：
   - 详情页展示 Ed25519 签名摘要 (`digest`)、密钥标识 (`keyId`) 与签名时间戳，增强玩家信任度。

---

## 本地开发与构建指南

在仓库根目录 `G:\Project\daydrift\daydrift-mods` 下执行：

```bash
# 启动本地开发热重载服务器 (端口 4323)
pnpm --filter @daydrift/store dev

# 编译静态页面
pnpm --filter @daydrift/store build

# 全流程测试与发布构建 (包含签名验证、索引生成与页面编译)
pnpm run build:store
```
构建产物输出至 `dist/` 目录，可直接发布至 Cloudflare Pages。
