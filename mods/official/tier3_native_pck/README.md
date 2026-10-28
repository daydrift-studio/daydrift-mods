# Tier 3 原生 PCK 模组示范工程 (Native PCK)

本工程是《度日：Daydrift》三体系 Mod 架构中 **Tier 3 原生全能扩展** 的官方标准示范模组。

---

## 体系特性
- **面向群体**：独立游戏开发者、深度魔改工程师；
- **编程门槛**：Godot 4 / GDScript 原生开发能力；
- **核心格式**：`.pck` 编译资源包 + `entry.gd`；
- **一等公民设计**：挂载在场景树根节点 `/root` 下，`process_mode = PROCESS_MODE_ALWAYS`；
- **控制力**：**100% 游戏原生代码等价 (Full Native Code Equivalence)**；
- **核心能力**：
  - 直达 10 大核心单例与服务引用（`tree`, `event_bus`, `time_manager`, `save_manager`, `audio_manager` 等）；
  - 10 大生命周期与第 0 帧场景树拦截钩子（`_on_node_added_anywhere` 等）；
  - 原生资源劫持（`hijack_resource`）与运行时脚本热替换（`patch_node_script`）；
  - 动态生成物理实体房间门（`spawn_physical_door`）与自定义 UI 挂载（`mount_ui_node`）；
  - 全自动零残留安全回滚（`_rollback_all_managed_changes`）。

---

## 包含文件
- `manifest.json`：清单配置（声明 `tier: 3`, `type: "native"`, `entry: "entry.gd"`）；
- `entry.gd`：继承 `DaydriftNativeMod` 的主入口脚本；
- `preview.webp`：模组封面预览图。
