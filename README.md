# clawsmith 产品官网

静态产品官网，介绍 clawsmith 的定位、功能、工作方式、安全边界和常见问题，并在
`docs/` 下提供独立使用手册。

本地预览：

```bash
python3 -m http.server 4173 --directory website
```

打开 `http://127.0.0.1:4173`。

使用手册：

```text
http://127.0.0.1:4173/docs/
```

官网源码保留在主仓库的 `website/` 目录，公开部署仓库为
[`sql668/clawsmith-site`](https://github.com/sql668/clawsmith-site)。该公开仓库只包含静态官网
文件，并使用自己的 GitHub Actions 工作流发布 GitHub Pages。

## 自动同步

主仓库的 [`.github/workflows/sync-website.yml`](../.github/workflows/sync-website.yml)
会在 `website/**` 变化后，把静态资源同步到公开站点仓库。首次启用需要：

1. 在 GitHub 创建只允许访问 `sql668/clawsmith-site` 的 fine-grained personal access token。
2. Repository permissions 只授予 **Contents: Read and write**。
3. 在主仓库 Actions Secrets 中新增 `CLAWSMITH_SITE_TOKEN`，值为该 token。
4. token 到期前更换 Secret；工作流本身不打印 token。

公开站点仓库的 Pages 工作流随后自动重新部署。主仓库只获得读取自身源码的权限，跨仓库写入
仅由这个最小权限 token 完成。

正式地址：

```text
https://sql668.github.io/clawsmith-site/
```

修改内容时保持以下约束：

- 不依赖后端接口或第三方脚本。
- 所有站内资源使用相对路径，确保 GitHub Pages 子路径部署可用。
- 不宣称完全离线；模型请求仍会发送到用户配置的 Provider。
- 不把当前专有许可证描述成开源许可证。
- 键盘导航、移动端布局和 `prefers-reduced-motion` 必须保持可用。
- 修改 CLI、Web 设置或默认工作流后，同步检查 `website/docs/index.html` 中的使用说明。
