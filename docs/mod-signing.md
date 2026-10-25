# 《度日：Daydrift》模组签名规范与操作指引 (Mod Signing Specification)

本文档定义《度日：Daydrift》官方与社区模组（Mod）的 Ed25519 签名格式、摘要计算、渠道隔离规则与密钥生命周期管理。

---

## 1. 算法与安全边界

- **签名算法**：Ed25519（JWK `OKP` / `crv: Ed25519`，纯 32 字节公钥，64 字节签名）。
- **签名文件**：模组根目录下的 `daydrift.sig.json`。
- **格式标识**：`daydrift-signature`。
- **协议版本**：`1`。
- **大小限制**：单 Mod 文件数上限 ≤ 4000，解压总体积 ≤ 128 MiB。
- **安全检查**：禁止符号链接、设备文件、套接字、路径穿越（`..`、`.`、空段）、大小写折叠冲突与 Unicode NFC 冲突。

---

## 2. 覆盖范围与摘要计算

签名覆盖模组目录下除以下文件外的所有普通文件：
- 根目录的 `daydrift.sig.json`
- 任意子目录的 `.DS_Store`、`Thumbs.db`、`desktop.ini`

### 2.1 行格式与排序
所有相对路径统一经 Unicode NFC 规范化，并强制转换为正斜杠 `/` 分隔。
所有文件条目严格按照其相对路径的 **UTF-8 字节序**升序排序。

每个文件生成一行：
```text
<64位十六进制SHA-256><空格><相对路径><LF>
```

### 2.2 内容摘要计算
将上述排序拼接后的全部行（`lines`）整体计算 SHA-256，得到 64 位十六进制散列：
```text
sha256:<64位小写hex>
```
此即该模组的 `digest`。

---

## 3. 待签名消息结构 (Canonical Signed Message)

待签名消息必须逐字节构造为严格的 6 行 ASCII/UTF-8 文本，并以空行结尾（即以 `\n\n` 结尾）：

```text
daydrift-signature/1
modId=<manifest.id>
modVersion=<manifest.version>
digest=sha256:<64位小写hex>
keyId=<keyId>
signedAt=<RFC3339 UTC时间戳>

```

签名结果采用标准 Base64 编码（包含 `=` 填充）。

---

## 4. 签名文件格式 `daydrift.sig.json`

```json
{
  "format": "daydrift-signature",
  "version": 1,
  "modId": "example_rainy_coffee",
  "modVersion": "1.0.0",
  "digest": "sha256:727704831dd20aeb0c52d0e68265ab074451e75cf87e9180cf8d6167be8eb925",
  "keyId": "official-offline-v1",
  "signedAt": "2026-10-25T09:13:31.084Z",
  "signature": "L/Zl0xRD29rHAOO+33Wt0224qZz83xV/nOwWXCCyPuDOQF+zRgiO2XRAlPeYeLDbZooiiiCXSZAl7CoD7bkSDg=="
}
```

---

## 5. 渠道隔离与可信密钥管理

### 5.1 渠道映射

| 目录 | 准入渠道 | 对应密钥类别 | 商店状态 |
| :--- | :--- | :--- | :--- |
| `mods/official/` | `release` | 官方离线主密钥 (`official-offline-v1`) 或 CI release 备用密钥 | 官方认证 (`verified`) |
| `mods/community/` | `release` | CI 审核通过的 release 密钥 (`ci-release-v1`) | 官方认证 (`verified`) |
| `mods/beta/` | `beta` | CI 先行测试密钥 (`ci-beta-v1`) | 先行测试 (`beta`) |

### 5.2 校验状态与错误代码
- `verified`：签名有效、公钥属于 `release` 渠道且未吊销、摘要一致、未被撤回。
- `beta`：签名有效、公钥属于 `beta` 渠道且未吊销、摘要一致、未被撤回。
- `unsigned`：缺失 `daydrift.sig.json`。
- `invalid` 拒绝原因：
  - `malformed`：JSON 结构损坏或字段格式不合法。
  - `unknown-key`：`keyId` 不在 `keys/trusted-keys.json` 中。
  - `revoked-key`：公钥被标记为 `revoked: true`。
  - `bad-signature`：Ed25519 公钥验签不通过。
  - `mod-mismatch`：签名内的 `modId` 或 `modVersion` 与 `manifest.json` 不符。
  - `digest-mismatch`：文件内容被篡改。
  - `wrong-channel`：密钥渠道与所在目录不符（如 `beta` 目录使用了 release 密钥）。
  - `revoked-mod`：模组摘要已列入 `keys/revoked-mods.json`。
  - `unsafe-tree`：检测到符号链接、路径穿越或大小写冲突。

---

## 6. 确定性 ZIP 打包规范

为保证不同平台构建出的分发包 SHA-256 绝对一致，`tools/pack-zip.mjs` 强制遵循：
1. 顶层仅包含单一文件夹 `<modId>/`；
2. 条目严格按照内部相对路径的 UTF-8 字节序升序排列；
3. 固定 DOS 时间戳 `1980-01-01 00:00:00`（DOS Date: `0x0021`, DOS Time: `0x0000`）；
4. 文件统一权限 `0644`，目录统一权限 `0755`；
5. 固定 Deflate 压缩级别 9；
6. 自动排除 `.git`、`.github`、`node_modules`、系统元文件及现有 zip 包。

---

## 7. 密钥轮换与撤回流程

1. **密钥轮换**：
   - 运行 `node tools/keygen.mjs --key-id <new_id> --channel <release|beta>` 生成新密钥；
   - 将新公钥添加至 `keys/trusted-keys.json` 与客户端 `src/core/mod/trusted_keys.json`；
   - 旧密钥在两处均标为 `"revoked": true`；
   - CI 工作流执行重新签名。
2. **恶意模组紧急撤回**：
   - 获取该版本模组的 `digest`；
   - 将其加入 `keys/revoked-mods.json` 的 `revokedDigests` 数组中；
   - 从 `mods/` 目录中移除该版本；
   - 重新运行 `node tools/build-index.mjs` 更新目录。
