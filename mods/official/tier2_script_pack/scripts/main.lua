-- ==============================================================================
-- 《度日：Daydrift》Tier 2 客户端脚本入口 (scripts/main.lua)
-- 演示客户端安全沙盒生命周期、ModAPI 交互注入与联机网络报文通信
-- ==============================================================================

local current_weather = "晴朗"

-- 模组就绪回调
function on_loaded()
    ModAPI.toast("微风气象站已上线：已连接联机气象同步信道。")
    
    -- 向窗户家具注入天气观测选项
    ModAPI.add_choice("bedroom_window", "[气象站] 观测窗外实时天气", "on_observe_weather_clicked")
end

-- 观测天气分支被点击
function on_observe_weather_clicked()
    local p_name = ModAPI.get_period_name()
    local day = ModAPI.get_day()
    ModAPI.say(string.format("现在是第 %d 天的 %s，窗外的天空正是一片 %s。", day, p_name, current_weather), "微风气象仪")
end

-- 监听四时更迭事件 (0: 清晨, 1: 正午, 2: 傍晚, 3: 深夜)
ModAPI.on_event("period_changed", function(prev_period, new_period)
    local p_name = ModAPI.get_period_name()
    ModAPI.toast(string.format("【气象观测】时段更迭至：%s（当前天气：%s）", p_name, current_weather))
end)

-- 监听跨天结算事件
ModAPI.on_event("day_advanced", function(new_day)
    local day = ModAPI.get_day()
    ModAPI.set_data("recorded_days", day)
end)

-- 监听服务端发送的天气同步网络报文
ModAPI.on_net_packet("weather_update", function(sender_id, payload)
    if payload and payload.weather then
        current_weather = payload.weather
        ModAPI.toast(string.format("【联机气象广播】小镇天气更新为：%s", current_weather))
    end
end)

-- 向联机房间发起天气变更请求
function request_weather_change(new_weather_name)
    ModAPI.send_net_packet("request_weather", {
        weather = new_weather_name
    })
end
