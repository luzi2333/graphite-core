# 部署到 GitHub Pages

这个项目是纯静态的：`index.html` + `css/` + `js/`，不需要构建，也没有后端。

## 1. 建仓库

GitHub → 右上角 **+** → **New repository**

- Repository name：随便，比如 `graphite-core`
- 可见性选 **Public**（免费账号的 Pages 只支持公开仓库）
- 不要勾选 Add a README / .gitignore，直接 **Create repository**

## 2. 上传文件

### 网页版（不用装 git）

1. 新仓库页面点 **uploading an existing file**
2. 打开本地的 `graphite-core` 文件夹，**把里面的内容**（`index.html`、`css`、`js`、`.nojekyll`、`README.md`）全选拖进浏览器
   - 拖「文件夹里的内容」，不是拖 `graphite-core` 这一层，这样链接最短
   - 拖整个文件夹也能用，只是链接会多一段 `/graphite-core/`
3. 下面填一句提交信息，点 **Commit changes**

拖完后仓库根目录应该是：

```
index.html
.nojekyll
css/style.css
js/audio.js  js/lattice.js  js/patterns.js  js/renderer.js  js/ui.js  js/main.js
README.md
```

### 命令行

```bash
cd 路径/graphite-core
git init
git add .
git commit -m "graphite core"
git branch -M main
git remote add origin https://github.com/你的用户名/graphite-core.git
git push -u origin main
```

## 3. 开启 Pages

仓库 → **Settings** → 左侧 **Pages**

- Source 选 **Deploy from a branch**
- Branch 选 **main**，目录选 **/ (root)**
- 点 **Save**

等 1–2 分钟，页面上方会出现：

```
Your site is live at https://你的用户名.github.io/graphite-core/
```

## 4. 验证

打开链接，依次确认：

1. 不操作时画面在跳（演示信号）
2. 面板里「捕捉电脑声音」**可以点**（github.io 是 HTTPS，满足安全上下文要求）
3. 拖一个 mp3 进去能播
4. 拖拽环绕、滚轮缩放正常

## 更新

改完文件后重新提交（网页版：进文件 → 编辑 → Commit，或重新上传覆盖），Pages 会在一分钟内重建。

浏览器缓存可能导致看到旧版：**Ctrl + Shift + R** 强刷。

## 常见问题

| 现象 | 原因 |
|---|---|
| 404 | `index.html` 不在 main 分支根目录；或 Pages 还没构建完 |
| 链接变成 `/仓库名/graphite-core/` | 上传时多套了一层文件夹 |
| 只有黑底 / 脚本没跑 | 文件没上传全，或 `.js` 路径层级不对 |
| Pages 设置里没有 Deploy from a branch | 仓库是 Private，免费账号不支持 |
| 改了没生效 | 缓存，强刷；或等 Pages 构建完成 |

## 说明

- `github.io` 在中国大陆访问经常很慢甚至打不开。主要是给国内朋友用的话，更稳的是腾讯云 COS 静态网站（见 README）。
- 自定义域名：Settings → Pages → Custom domain，按提示在 DNS 里加 CNAME；启用后勾上 Enforce HTTPS。
- `.nojekyll` 这个空文件用来跳过 Jekyll 处理，避免下划线开头的文件被忽略；本项目的文件名不受影响，但留着没坏处。
