-- ==============================================================================
-- 《度日：Daydrift》官方示范模组: 雨天手冲咖啡馆与街角漫步
-- 完整演示 Tier 2 双端脚本沙盒能力，覆盖起居卧室、连绵街道与秘密阁楼三大场景
-- ==============================================================================

-- 模组装载完成时回调
function on_loaded()
    ModAPI.toast("手冲挂耳咖啡模组已激活：已扩展卧室、街道与秘密阁楼交互。")
    -- 动态注册场景交互选项分支
    ModAPI.add_choice("kettle", "[手冲咖啡] 冲泡深度烘焙曼特宁", "on_brew_coffee_clicked")
    ModAPI.add_choice("street_bench", "[手冲咖啡] 端着咖啡在长椅静听街景", "on_bench_coffee_clicked")
    ModAPI.add_choice("street_lamp", "[手冲咖啡] 在暖灯下小憩", "on_lamp_coffee_clicked")

    -- 监听来自联机房间的同游旅人寄语
    ModAPI.on_net_packet("coffee_cheer", function(sender_id, payload)
        local cheer_text = payload.note or "愿你在小镇享受温暖的时光"
        ModAPI.toast("旅人 [" .. sender_id .. "] 传来咖啡寄语: " .. cheer_text)
    end)
end

-- 场景物体交互触发回调
function on_interacted(target_id)
    if target_id == "kettle" then
        local count = ModAPI.get_data("coffee_count", 0) + 1
        ModAPI.set_data("coffee_count", count)
        ModAPI.set_flag("brewed_coffee", true)
    elseif target_id == "street_bench" then
        ModAPI.set_flag("drank_coffee_today", true)
    elseif target_id == "attic_door" then
        ModAPI.set_flag("visited_attic", true)
        ModAPI.toast("推开厚重木门，踏入了秘密阁楼咖啡角。")
    end
end

-- 卧室水壶冲泡选项被选中
function on_brew_coffee_clicked()
    ModAPI.toast("热水注入滤纸，曼特宁油脂泛起微光...")
    ModAPI.choice("我", "热气腾腾的咖啡已经萃取完毕，接下来要做什么？", {
        "在桌前静静品尝并写下日记",
        "端到窗边看着街道雨雾",
        "向联机旅人们分享一份暖意"
    }, "on_coffee_branch_selected")
end

-- 玩家选择后续分支
function on_coffee_branch_selected(choice_index, choice_text)
    if choice_index == 0 then
        ModAPI.toast("坐在书桌前，在日记本留下一段静谧文字。")
        ModAPI.set_flag("wrote_morning_journal", true)
    elseif choice_index == 1 then
        ModAPI.toast("倚窗听雨，街道在微光与雨雾中若隐若现。")
    elseif choice_index == 2 then
        -- 触发双端联机寄语报文广播
        send_coffee_cheer_to_room("愿每一位慢步在雨中的旅人都能拥有一杯温热的咖啡。")
    end
end

-- 街道长椅选项被选中
function on_bench_coffee_clicked()
    ModAPI.toast("微风吹过街角长椅，咖啡的余温驱散了秋雨的微寒。")
    ModAPI.set_flag("drank_coffee_today", true)
end

-- 街灯选项被选中
function on_lamp_coffee_clicked()
    local period = ModAPI.get_period()
    if period >= 2 then
        ModAPI.toast("街灯的橘黄色光芒格外柔和，适合稍事停歇。")
    else
        ModAPI.toast("街灯在晨光与雨丝中静默矗立。")
    end
end

-- 向联机同游房间广播寄语
function send_coffee_cheer_to_room(note_message)
    ModAPI.send_net_packet("coffee_cheer", {
        mood = "serene",
        note = note_message
    })
    ModAPI.toast("已向同游房间广播咖啡寄语。")
end

-- 四时时段推移回调 (0:清晨, 1:正午, 2:傍晚, 3:深夜)
function on_period_changed(prev_period, curr_period)
    if curr_period == 3 then
        ModAPI.toast("夜色渐浓，阁楼壁炉的柴火慢慢沉入余烬。")
    end
end

-- 跨天结算时回调
function on_day_advanced(new_day)
    -- 清理前一日的饮用标记
    ModAPI.set_flag("brewed_coffee", false)
    ModAPI.set_flag("drank_coffee_today", false)
end

-- 场景进入回调
function on_scene_entered(scene_path)
    if string.find(scene_path, "bedroom") then
        local brewed = ModAPI.get_flag("brewed_coffee", false)
        if brewed then
            ModAPI.toast("卧室内仍飘散着淡淡的咖啡甘香。")
        end
    elseif string.find(scene_path, "street") then
        ModAPI.toast("漫步于 1440 像素的街道长卷中，雨气清润。")
    end
end
