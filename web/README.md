## pnpm

```shell
# 安装依赖
pnpm install
# 添加依赖
pnpm add <package>
# 移除依赖
pnpm remove <package>
# 开发
pnpm dev
# 构建
pnpm build
```

## shadcn/ui

```shell
# 初始化
pnpm dlx shadcn@latest init

# 添加组件
pnpm dlx shadcn@latest add button
```

## openapi-typescript

```shell
# 生成openapi类型
 pnpm dlx openapi-typescript http://127.0.0.1:8080/openapi/v1.json -o src/api/schema.d.ts
```