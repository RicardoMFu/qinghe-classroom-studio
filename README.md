# 青禾班主任工作台

面向重庆市涪陵第五中学七年级15班的轻量班主任工作台。包含工作台首页、学校 Excel/CSV 成绩导入与等级分析、座次调整、学生名册、值日编辑和待办。

线上地址：<https://ricardomfu.github.io/qinghe-classroom-studio/>

## 本机运行

```bash
npm install
npm run dev
```

打开终端显示的本机地址；同一局域网的其他设备可打开 `http://本机局域网IP:5173`。

生产构建：

```bash
npm run build
npm run preview
```

`preview` 默认监听 `0.0.0.0`。如需常驻运行，建议后续使用固定域名 + HTTPS 部署；仅局域网 IP 无法跨不同网络稳定访问。

## 已落地功能

- 直接读取学校成绩 Excel 的“七年级15班”工作表，仅保留姓名与七科等级；身份号、学籍号、考号不导入。
- 同时支持 CSV 成绩导入、校验、统计、学科筛选和排名。
- 新增学生并同步到名册与座次表。
- 两次点击交换座位，避免拖拽误操作。
- 值日安排编辑、待办新增/完成与刷新持久化。
- 桌面、平板、手机响应式，PWA 外壳和 GitHub Pages 自动部署。

## 多人同步配置

1. 创建 Supabase 项目，在 SQL Editor 执行 [`supabase/schema.sql`](supabase/schema.sql)。
2. 在 Authentication 创建或邀请班级成员；复制用户 UUID，按 SQL 文件末尾示例加入 `classroom_members`。建议班主任为 `owner`，协作教师为 `editor`，仅查看成员为 `viewer`。
3. 在 Database Replication 中为 `classroom_states` 开启 Realtime。
4. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. 在 Supabase Auth URL Configuration 中加入线上地址 `https://ricardomfu.github.io/qinghe-classroom-studio/`。
6. 重新运行 GitHub Pages 工作流。登录后由授权教师导入原始 Excel，其他已登录成员会看到同一份最新数据。

浏览器中只允许使用 publishable key。`service_role` key 不得写入 `.env`、前端代码或 GitHub。

## 测试

```bash
npm test
npm run build
```

GitHub Actions 会在每次推送后重复运行测试和构建，通过后才发布。

## 数据边界

未配置 Supabase 时，线上版仅包含演示数据并保存在当前浏览器。配置后，未登录访问者只能看到登录页；已授权成员通过数据库行级权限共享15班最新数据，每次改动保留历史版本。真实成绩文件和导入后的学生数据不会提交到 GitHub。
