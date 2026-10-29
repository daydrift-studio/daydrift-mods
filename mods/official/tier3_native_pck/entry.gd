extends DaydriftNativeMod

## 《度日：Daydrift》Tier 3 原生 PCK 模组主入口官方示范
## 继承 DaydriftNativeMod，作为一等公民挂载于 /root 下，
## 拥有与游戏本体代码 100% 完全对等的引擎控制力与全自动无感知回滚机制。

func _on_mod_init() -> void:
	print("[%s] Tier 3 原生模组挂载初始化..." % mod_id)
	# 动态覆写原生多语言词条（进入主菜单即刻见效，卸载时自动从 TranslationServer 撤回）
	override_tr("zh_CN", "MENU_START", "开启温馨新旅途 (Tier 3 已注入)")
	override_tr("en", "MENU_START", "Begin Warm Journey (Tier 3 Active)")


func _on_mod_enable() -> void:
	print("[%s] Tier 3 原生模组正式进入场景树就绪！" % mod_id)

	# 1. 动态注册自定义全局热键 (F6)
	register_keybind("mod_tier3_test_action", KEY_F6)

	# 2. 动态向卧室水壶注入原生交互选项
	inject_interaction_choice("kettle", "【Tier 3 模组】沏一壶特调茉莉香茗", func() -> void:
		say("温馨茶壶", "淡淡的茉莉清香弥漫在空气中，带来片刻的舒缓与惬意。")
	)

	# 3. 动态向主菜单挂载金色状态标牌，开屏即见效果
	var menu_badge := Label.new()
	menu_badge.name = "ModTier3MenuBadge"
	menu_badge.text = "[Tier 3 原生扩展已就绪 - 按 F6 测试]"
	menu_badge.set("theme_override_colors/font_color", Color(0.95, 0.8, 0.35, 1.0))
	menu_badge.position = Vector2(16, 12)
	mount_ui_node("MainMenu", menu_badge)

	# 4. 动态向 InGameHUD 挂载游戏内常驻状态控件
	var hud_badge := Label.new()
	hud_badge.name = "ModTier3HUDBadge"
	hud_badge.text = "[Tier 3 原生控制力生效中]"
	hud_badge.set("theme_override_colors/font_color", Color(0.95, 0.8, 0.35, 1.0))
	hud_badge.position = Vector2(8, 28)
	mount_ui_node("InGameHUD", hud_badge)


func _on_scene_ready(scene_id: String, _scene_root: Node) -> void:
	var lower_id := scene_id.to_lower()

	# 当进入卧室起居室时，在右侧生成一扇通往街道的额外专属木门
	if lower_id.contains("bedroom"):
		spawn_physical_door(
			scene_id,
			Vector2(480, 200),
			"res://src/locations/street/street.tscn",
			Vector2(120, 260),
			"【Tier 3 传送门】直达喧闹街道"
		)

	# 当进入街道场景时，在指定世界坐标生成一扇物理实体木门 (RoomDoor) 返回卧室
	elif lower_id.contains("street"):
		spawn_physical_door(
			scene_id,
			Vector2(880, 420),
			"res://src/locations/bedroom/bedroom.tscn",
			Vector2(160, 280),
			"【Tier 3 传送门】推门返回温馨起居室"
		)


func _on_node_added_anywhere(node: Node) -> void:
	# 第 0 帧全场景穿透检测节点入树
	if node.is_in_group("player"):
		print("[%s] 检测到玩家实体进入场景树: %s" % [mod_id, node.name])


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("mod_tier3_test_action"):
		toast("已触发 Tier 3 模组原生快捷键 (F6)！全套引擎底层服务直达运行。")


func _on_mod_disable() -> void:
	# 自动触发基类 _rollback_all_managed_changes() 干净回滚所有资源接管与注入节点
	super._on_mod_disable()
	print("[%s] Tier 3 原生模组已停用，所有托管资源与节点已 100%% 安全回滚。" % mod_id)
