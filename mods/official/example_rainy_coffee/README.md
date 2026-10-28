# 《雨天手冲咖啡馆与街角漫步》官方示范模组

本模组为《度日：Daydrift》官方核心示范模组，全面覆盖游戏内**三大核心生活场景**，演示 Tier 2 双端脚本沙盒、叙事事件切片、多语言本地化与联机自定义报文。

---

## 覆盖三大核心场景

### 1. 场景一：起居卧室 (`bedroom`)
- **烧水壶 (`kettle`)**：冲泡热挂耳曼特宁咖啡，水汽蒸腾白噪音，增加咖啡计数持久化存档；
- **书桌 (`desk`)**：端起热咖啡在书桌前记录晨昏日记；
- **卧室落地窗 (`bedroom_window`)**：倚窗聆听细密雨丝，小镇正在雨雾中缓缓苏醒。

### 2. 场景二：长卷街道 (`street`)
- **街道长椅 (`street_bench`)**：坐在微凉的木质长椅上小憩品咖，眺望撑伞走过的同游旅人；
- **铸铁街灯 (`street_lamp`)**：在暖黄光晕下驻足，根据傍晚或深夜时段触发不同的感悟对白。

### 3. 场景三：秘密空间与物理木门 (`coffee_attic`)
- **秘密实体门 (`attic_door`)**：推开厚重雕花木门，进入避风避雨的阁楼秘密咖啡角；
- **跨场景黑板联动**：同步 `brewed_coffee`、`visited_attic` 与 `warmth_level`；
- **联机寄语广播**：向联机房间的全体在线旅人发送 `coffee_cheer` 咖啡暖意寄语。

---

## 模组文件解构

```text
example_rainy_coffee/
├── manifest.json                  # 模组元数据清单 (v2 规范)
├── preview.webp                   # 模组封面图 (1280x720)
├── narrative/                     # 三大场景叙事切片 JSON
│   ├── bedroom_coffee.json        # 场景一：卧室水壶、书桌与落地窗
│   ├── street_coffee.json         # 场景二：街道长椅与铸铁街灯
│   └── coffee_attic.json          # 场景三：秘密阁楼木门与避难所
├── data/
│   └── i18n/
│       └── translations.csv       # 中英日三语完整对照表
└── scripts/
    └── main.lua                   # 客户端 Lua 沙盒生命周期与联机报文
```

---

## 创作者参考指南

1. **测试运行**：使用 `ddmod_cli.py dev-link .` 即可秒级软链接至游戏 `mods/` 目录；
2. **多语言词条**：请参阅 `data/i18n/translations.csv`，推荐使用词条键而不是在 JSON 中硬编码中文字符；
3. **联机通信**：请参考 `scripts/main.lua` 中的 `ModAPI.send_net_packet` 与 `ModAPI.on_net_packet`。
