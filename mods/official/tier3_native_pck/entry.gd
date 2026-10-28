extends DaydriftNativeMod

## 《度日：Daydrift》Tier 3 原生 PCK 模组主入口官方示范
## 继承 DaydriftNativeMod，作为一等公民挂载于 /root 下，
## 拥有与游戏本体代码 100% 完全对等的引擎控制力与全自动无感知回滚机制。

func _on_mod_init() -> void:
	print("[%s] Tier 3 原生模组挂载初始化..." % mod_id)
	# 动态覆写原生多语言词条（卸载时自动从 TranslationServer 撤回）
	override_tr("zh_CN", "UI_NEW_GAME", "开启温馨新旅途")
	override_tr("en", "UI_NEW_GAME", "Begin Warm Journey")


func _on_mod_enable() -> void:
	print("[%s] Tier 3 原生模组正式进入场景树就绪！" % mod_id)

	# 1. 动态注册自定义全局热键 (F6)
	register_keybind("mod_tier3_test_action", KEY_F6)

	# 2. 动态向卧室水壶注入原生交互选项
	inject_interaction_choice("kettle", "用原生模组茶壶沏一壶茉莉香茗", func() -> void:
		say("温馨茶壶", "淡淡的茉莉清香弥漫在空气中，带来片刻的舒缓与惬意。")
	)

	# 3. 动态将自定义原生 UI 控件挂载到 InGameHUD
	var badge := Label.new()
	badge.name = "ModTier3StatusBadge"
	badge.text = "[Tier 3 Native Active]"
	badge.set("theme_override_colors/font_color", Color(0.9, 0.75, 0.4, 1.0))
	badge.position = Vector2(8, 8)
	mount_ui_node("InGameHUD", badge)


func _on_scene_ready(scene_id: String, _scene_root: Node) -> void:
	# 当进入街道场景时，在指定世界坐标生成一扇物理实体木门 (RoomDoor)
	if scene_id.to_lower().contains("street"):
		spawn_physical_door(
			scene_id,
			Vector2(880, 420),
			"res://src/locations/bedroom/bedroom.tscn",
			Vector2(160, 280),
			"推门返回温馨起居室"
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
	print("[%s] Tier 3 原生模组已停用，所有托管资源与节点已 100% 安全回滚。" % mod_id)
