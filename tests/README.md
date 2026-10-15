# 自动化测试

完整测试计划见 [docs/testing/TEST_PLAN.md](../docs/testing/TEST_PLAN.md)。

## 前置条件

- Docker 已运行
- Supabase CLI（`brew install supabase/tap/supabase`）
- 首次运行：`npm install && npx playwright install chromium`

## 运行

```bash
npm run test:db:start          # 启动本项目专用的本地 Supabase（端口 554xx，自动应用 migrations；测试种子由 global setup 写入）
npm run test:e2e               # 全部测试（API + 浏览器）
npm run test:security          # SEC-01 ~ SEC-08；首次会构建到 .next-e2e/，并在 3100 端口启动测试服务器
npm run test:security:strict   # 同上，但已知缺陷不再标记为“预期失败”，可以看到真实的断言失败
npm run test:report            # 打开 HTML 报告
npm run test:db:stop           # 停止本地 Supabase
```

可选：Upstash 限流测试（`tests/api/rate-limit.spec.ts`）需要一个本地的 Upstash 兼容服务，未运行时这组测试会自动跳过：

```bash
docker network create selflove-rl
docker run -d --rm --name selflove-rl-redis --network selflove-rl redis:8-alpine
docker run -d --rm --name selflove-rl-srh --network selflove-rl -p 55479:80 \
  -e SRH_MODE=env -e SRH_TOKEN=e2e-upstash-token \
  -e SRH_CONNECTION_STRING=redis://selflove-rl-redis:6379 hiett/serverless-redis-http
```

数据库 schema 改动后需要重置：`supabase db reset --local`（一定要带 `--local`，本目录同时链接了线上项目）。

## 约定

- 测试服务器只读取 `tests/e2e.env`。`.env.local` 里有、但 `tests/e2e.env` 里没有的变量会被置空，防止测试连到线上的 Supabase、Shopify 或 Resend。
- Shopify Storefront API 由 `tests/mocks/shopify-storefront.ts`（端口 3199）模拟，只实现了礼品卡商品查询和 `cartCreate`。其他查询会返回错误，应用随之回退到内置的模拟商品数据。测试可以通过 `tests/helpers/shopify-mock.ts` 读取应用实际发给 Shopify 的请求。
- 测试环境下邮件不会真的发出，而是以 JSON 格式写入 `.e2e-outbox/`（见 `src/lib/email.ts` 里的 `deliver()`），测试直接检查邮件的最终 HTML。
- 每次运行前，`tests/global-setup.ts` 会删除所有 `*@test.local` 用户以及 `e2e-*`、`E2E*` 开头的数据，然后重新写入种子数据。
- 测试断言的是**安全/正确的行为**。对应已知缺陷的用例用 `knownDefect('Dxx', …)` 标记：缺陷存在时测试算通过；缺陷修复后测试会变红，这时删除那一行 `knownDefect` 即可。
- 修改代码后如果测试服务器没有重新构建：本地默认复用 3100 端口上已经在运行的服务器，先停掉它，或者删除 `.next-e2e/`。

生产就绪与两种数据库状态的测试流程见 [上线配置](../docs/setup/upstash-and-shopify-discounts.md)。新增 `test:unit` 与 `test:migrations`；迁移矩阵只写固定的本地隔离数据库，不复制生产数据。
