# 《度日：Daydrift》模组商店与中心注册表 (Mod Store & Registry)

欢迎来到《度日：Daydrift》官方模组注册表与创作者商店代码仓库。本仓库承担着整个模组生态的**中心索引注册、供应链安全审计、Ed25519 数字签名验证与全静态边缘分发**。

- 🌐 **在线商店门户**：[daydrift-mods.blym.top](https://daydrift-mods.blym.top)
- 📖 **开发者文档中心**：[daydrift-docs.blym.top](https://daydrift-docs.blym.top)
- 🛠️ **模组开发工具包**：[daydrift-mod-sdk](https://github.com/daydrift-studio/daydrift-mod-sdk)

---

## 目录架构解构

```text
daydrift-mods/
├── apps/
│   └── store/                 # Astro 纯静态 Web 商店前端应用
├── mods/
│   ├── official/              # 官方第一方维护模组 (例: example_rainy_coffee)
│   ├── community/             # 社区创作者投稿且已通过人工/自动化审计的模组
│   └── beta/                  # 先行测试渠道模组
├── keys/
│   ├── trusted-keys.json      # 全网受信任的官方签名公钥清单 (透明度公示)
│   └── revoked-mods.json      # 已吊销的恶意/漏洞模组指纹黑名单
├── tools/
│   ├── build-index.mjs        # 扫描并构建 catalog.json 与 index.json 注册表
│   ├── import-submission.mjs  # 自动化模组审查、归一化、签名与导入脚本
│   ├── pack-zip.mjs           # 跨平台确定性 ZIP 归档打包器
│   ├── sign.mjs               # 官方 Ed25519 私钥数字签名工具
│   ├── verify.mjs             # 静态安全审计与签名验签工具
│   └── lib/signing.mjs        # 核心目录指纹与跨平台换行符 (LF) 算法实现
├── catalog.json               # 编译生成的全量模组元数据目录
└── index.json                 # 游戏客户端直连拉取的轻量索引
```

---

## 核心安全机制与签名规范

本仓库贯彻零信任供应链防御，所有收录并上架的模组均受 **Ed25519 数字签名** 严密保护：

1. **跨平台换行符归一化 (LF Normalization)**：
   - 代码与配置（`.json`、`.gd`、`.lua`、`.csv`、`.txt`、`.tscn`）在计算哈希前强制统一转换为 `\n`，消除 Windows (CRLF) 与 Linux/macOS 跨平台解压导致的哈希漂移。
2. **确定性目录树指纹 (Signed Digest Tree)**：
   - 遍历模组内所有合法文件并计算独立 SHA-256；
   - 相对路径按 UTF-8 字节序严格升序排序，拼装为签名清单并二次哈希，生成唯一的根指纹（`digest = sha256:<64位哈希>`）。
3. **Ed25519 权威签名 (`daydrift.sig.json`)**：
   - 官方使用受信任私钥对包含 `modId`、`modVersion`、`digest`、`keyId` 与 `signedAt` 的规范明文执行非对称签名；
   - 客户端载入时重新计算指纹并核对签名，篡改任何单个字节均会导致验签失败并阻断加载。
4. **确定性 ZIP 归档打包**：
   - 抹除动态文件修改时间，统一压缩参数，确保全世界任何机器打包生成的归档二进制哈希完全一致。

---

## 本地运维与开发指令

```bash
# 1. 安装项目依赖
pnpm install

# 2. 运行完整自动化测试套件与严格索引检查
pnpm test

# 3. 为指定模组重新签发 Ed25519 签名
node tools/sign.mjs mods/official/example_rainy_coffee --key keys/official-offline-v1.key.json

# 4. 导入社区提交的模组 (自动完成解包、换行归一化、测试、签名与索引更新)
node tools/import-submission.mjs path/to/submitted_mod_folder

# 5. 编译全站静态资源并同步至根目录 dist/
pnpm run build:store
```

---

## 社区创作者投稿提交流程 (GitOps PR)

1. Fork 本仓库至个人 GitHub 账号；
2. 在 `mods/community/<your_mod_id>/` 目录下添加你的模组源码；
3. 确保模组包含合规的 `manifest.json`、`preview.webp` 与完整的说明文档；
4. 运行 `node tools/verify.mjs mods/community/<your_mod_id>` 确保本地通过静态安全审计；
5. 发起 Pull Request，CI 自动化流水线将自动运行安全合规与配额检查；
6. 官方团队人工 Review 通过后，由维护者使用权威私钥为该模组签发数字签名并合并入主分支。
