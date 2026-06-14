# laozig 探针 · laozig-StatusShow

> 基于 [NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) 深度二开的服务器状态展示主题。

一个数据驱动的公开探针页面：实时节点状态、世界地图、费用统计、多主题外观，可部署到 NodeGet 主控，也可作为纯静态站丢到任意托管。

---

## ✨ 二开特性

- **8 套预设主题**：`nebula` 星云 / `cyberpunk` 赛博朋克 / `aurora` 极光 / `sakura` 樱花 / `terminal` 终端 / `mono` 石墨 / `midnight` 午夜 / `sunset` 日落。每套换字体、圆角、调色板、质感，访客可在页内主题面板实时切换。
- **17 种强调色 × 3 种卡片风格**（玻璃 / 经典 / 极简）× 明暗 / 跟随系统。
- **三视图**：卡片 / 表格 / 脉冲世界地图（`effectScatter` 光点定位、点击弹节点列表）。
- **费用统计**：实时汇率多币种换算（`open.er-api.com`，24h 缓存，失败回退静态）、月度成本占比、到期预警。
- **延迟图表**：Ping / TCP 多来源彩色线、质量分级、时间范围切换（30 分 / 1 时 / 6 时 / 24 时）。
- **交互增强**：键盘快捷键（`/` 搜索、`1/2/3` 切视图、`t` 主题、`b` 费用、`Shift+D` 明暗）、节点对比、右键收藏置顶、自定义右键菜单。
- **PWA 离线**：manifest + service worker，可「添加到主屏 / 安装」，离线可访问。
- **性能**：代码分割懒加载（地图 / 详情 / 费用页按需加载），节点离线浏览器原生通知。

更详细的二开记录见 [二开说明.md](二开说明.md)。

---

## 🖥️ 本地开发

```bash
npm i
cp .env.example .env.local   # 填入你的后端 backend_url 和 token
npm run dev
```

> 数据驱动的界面（节点列表 / 地图 / 费用）需要在 `.env.local` 配好后端才会有内容；主题面板、右键菜单等不依赖数据，可直接预览。

---

## 🚀 一键部署到 NodeGet 主控

NodeGet 主控面板支持「主题管理」直接添加一个**主题托管地址**，主控会去该地址拉取主题文件（`nodeget-theme.json` / `config.json` / `NodeGet-StatusShow.zip` 等，由 `npm run build` 的 `postbuild` 自动生成）。

> ⚠️ 一键部署需要主控版本 **0.2.6 以上**，请先到 [控制面板](https://dash.nodeget.com/#/dashboard/node-manage?tab=servers) 查看主控版本。

**快速添加本主题到主控：**

点击下面按钮即可在 NodeGet 主控添加 laozig 二开主题：

<a href="https://dash.nodeget.com/#/dashboard/theme-management?add=https://laozig-statusshow.pages.dev">
  <img src="https://dash.nodeget.com/deploy-button.png" alt="deploy button" width="230px" />
</a>

> 这是 laozig 的专属一键部署链接，拉取的是本二开主题的最新版。

---

## ☁️ Cloudflare Pages / Vercel 编译部署

最推荐的方式，方便后续升级。

**前置要求（很重要）：** 本地先同步 `package-lock.json`，确保依赖版本与 `package.json` 一致。CF Pages 用 `npm ci` 进行严格安装，lock 文件不同步会导致构建失败：

```bash
npm install
git add package-lock.json
git commit -m "sync package-lock.json"
git push
```

**部署步骤：**

1. 在 Cloudflare Pages / Vercel 新建项目，关联你的仓库 `laozig/laozig-StatusShow`。
2. 设置构建配置：
   - **构建命令**：`npm ci --legacy-peer-deps && npm run build`
   - **输出目录**：`dist`
3. 设定环境变量 `NODEGET_CONFIG`，值是一段有效的 JSON 字符串（示例见下）。
4. 部署，绑定域名。后续改了代码 push 即自动重新编译。

> 环境变量是 **build 时** 注入的，在面板里改完 `NODEGET_CONFIG` 后**必须重新部署一次**才生效，光改不重新 build 没用。

---

## ⚙️ 配置说明（`NODEGET_CONFIG`）

```json
{
  "user_preferences": {
    "site_name": "laozig 探针",
    "site_logo": "",
    "footer": "Powered by NodeGet · Crafted by laozig",
    "theme_preset": "nebula",
    "accent_color": "cyan",
    "card_style": "glass",
    "show_dashboard": true,
    "show_price": true,
    "show_expire": true,
    "show_particles": true,
    "announcement": ""
  },
  "site_tokens": [
    {
      "name": "master server node 1",
      "backend_url": "wss://your-backend.example.com",
      "token": "YOUR_TOKEN_HERE"
    }
  ]
}
```

**`user_preferences` 字段：**

| 字段 | 说明 | 取值 |
|---|---|---|
| `site_name` | 站点标题 | 任意文本 |
| `site_logo` | 站点图标链接 | URL，留空用默认 |
| `footer` | 页脚文本 | 任意文本 |
| `theme_preset` | 预设主题 | `nebula` / `cyberpunk` / `aurora` / `sakura` / `terminal` / `mono` / `midnight` / `sunset` |
| `accent_color` | 主题强调色 | `cyan` `sky` `blue` `indigo` `violet` `purple` `fuchsia` `pink` `rose` `red` `orange` `amber` `lime` `green` `emerald` `teal` `slate`（共 17） |
| `card_style` | 卡片风格 | `glass` / `classic` / `minimal` |
| `show_dashboard` | 顶部节点统计概览 | `true` / `false` |
| `show_price` | 卡片显示价格 | `true` / `false` |
| `show_expire` | 卡片显示到期倒计时 | `true` / `false` |
| `show_particles` | 背景粒子动画 | `true` / `false` |
| `announcement` | 顶部公告文本 | 任意文本，留空不显示 |

> 上面的预设主题 / 强调色 / 卡片风格只是**默认值**，访客可在页内主题面板自行切换并记忆。

`site_tokens` 是主控列表，每项支持 `name` / `backend_url` / `token` 三个字段，可配多个。

---

## 📦 静态文件部署

`npm run build` 后 `dist/` 是纯静态站，丢到任意静态托管（nginx / Cloudflare Pages / Vercel）即可。修改 `dist/config.json` 即可改配置，无需重新编译。

---

## 环境变量（旧版兼容）

除了 `NODEGET_CONFIG`，仍兼容旧版的分散环境变量：

```
SITE_NAME=laozig 探针
SITE_LOGO=https://example.com/logo.png
SITE_FOOTER=Powered by NodeGet · Crafted by laozig
SITE_1=name="master-1",backend_url="wss://m1.example.com",token="abc123"
SITE_2=name="master-2",backend_url="wss://m2.example.com",token="xyz789"
```

- 前三个对应 `site_name` / `site_logo` / `footer`，不写就用默认值。
- `SITE_n` 是主控，用 `key="value"` 逗号串起来，支持 `name` / `backend_url` / `token`；值里要塞引号或反斜杠用 `\"` 和 `\\` 转义。
- 从 `SITE_1` 连续往上数，中间断了就停。
- 一个 `SITE_n` 都没设就用仓库里的 `config.json`。
- 设了 `NODEGET_CONFIG` 则优先用它，忽略 `SITE_n`。

---

## 📄 协议与致谢

- 本项目基于 [NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) 二次开发，遵循 **AGPL-3.0** 协议。
- 感谢上游 NodeGet 团队的原始实现。
