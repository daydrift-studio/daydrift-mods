-- ==============================================================================
-- 《度日：Daydrift》Tier 2 服务端脚本入口 (server/main.lua)
-- 运行于 Go 独立服务端内部的受控 Lua 沙盒，负责联机状态同步与公共黑板管理
-- ==============================================================================

ServerAPI.log("微风气象站服务端模组已启动。")

-- 初始化公共黑板天气状态
ServerAPI.Blackboard.set("weather", "晴朗", true)

-- 注册管理员与玩家聊天指令 (输入 /weather <name>)
ServerAPI.Commands.register("weather", "查看或更改全镇天气状态", function(peer_id, args)
    if #args == 0 then
        local w = ServerAPI.Blackboard.get("weather") or "晴朗"
        return "当前全镇天气为：" .. w
    end
    
    local new_weather = args[1]
    ServerAPI.Blackboard.set("weather", new_weather, true)
    
    -- 广播网络信道更新报文给全体在线旅人
    ServerAPI.Net.broadcast("weather_update", {
        weather = new_weather,
        changed_by = peer_id
    })
    
    ServerAPI.broadcast("小镇上空的天气已变更为：" .. new_weather)
    return "已成功将全镇天气更新为：" .. new_weather
end)

-- 全局回调：新旅人加入房间
function on_player_join(peer_id, nickname)
    ServerAPI.log(string.format("旅人 %s (%s) 踏入了小镇。", nickname, peer_id))
    local w = ServerAPI.Blackboard.get("weather") or "晴朗"
    -- 单播发送当前天气给新入房玩家
    ServerAPI.Net.send(peer_id, "weather_update", {
        weather = w,
        changed_by = "server"
    })
end

-- 全局回调：收到来自客户端的模组网络报文
function on_net_packet(peer_id, channel, payload)
    if channel == "request_weather" and payload.weather then
        ServerAPI.log(string.format("旅人 %s 申请变更天气为: %s", peer_id, payload.weather))
        ServerAPI.Blackboard.set("weather", payload.weather, true)
        ServerAPI.Net.broadcast("weather_update", {
            weather = payload.weather,
            changed_by = peer_id
        })
    end
end
