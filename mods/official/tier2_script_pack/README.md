# Tier 2 双端脚本沙盒模组示范工程 (Script Pack)

本工程是《度日：Daydrift》三体系 Mod 架构中 **Tier 2 双端脚本沙盒** 的官方标准示范模组。

---

## 体系特性
- **面向群体**：数值机制设计者、轻度玩法程序员；
- **编程门槛**：基础 Lua 脚本开发能力；
- **核心格式**：客户端 `scripts/main.lua` + 服务端 `server/main.lua`；
- **安全保障**：虚拟指令配额熔断、内存上限保护，严格封禁 `os`/`io` 等系统级调用；
- **网络通信**：支持双端通过自定义信道（`OP_MOD_PACKET`）收发结构化 JSON 报文，服务端权威黑板同步。

---

## 包含文件
- `manifest.json`：清单配置（声明 `tier: 2`, `type: "lua"`, `entry: "scripts/main.lua"`）；
- `scripts/main.lua`：客户端 Lua 脚本，演示 `ModAPI` 事件监听、交互注入与报文接收；
- `server/main.lua`：服务端 Lua 脚本，演示 `ServerAPI` 公共黑板、自定义指令与广播；
- `preview.webp`：模组封面预览图。
