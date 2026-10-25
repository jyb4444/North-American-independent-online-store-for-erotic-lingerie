# 上线前配置：Upstash 限流 + Shopify 推荐奖励折扣码

> 先遵循下文 Stage A–E。前面三项服务商界面步骤只是经审批后的配置参考，不授权 App deploy、Vercel Redeploy 或修改生产变量。泄露 Admin token 的撤销/轮换必须先于任何生产代码发布。

按顺序做完以下四步。服务商的界面文字偶尔会调整，如果和这里写的不完全一致，找意思相近的按钮即可。

---

## 第 1 步：开通 Upstash Redis（限流用，免费）

**作用：** 网站部署后会同时运行多个服务器实例。限流计数存在 Upstash 里，所有实例才能共用同一份计数。不配置也能正常运行，只是限流退化为"每个实例各算各的"，防刷效果很弱。

**推荐方式：通过 Vercel 开通（环境变量会自动配好）**

1. 打开 <https://vercel.com>，登录后进入这个网站的项目。
2. 点击顶部的 **Storage** 标签 → **Create Database**（或 **Browse Marketplace**）。
3. 在列表里选 **Upstash**，再选 **Upstash for Redis**，点 **Continue**。
4. 填写配置：
   - **Plan**：选 **Free**。
   - **Primary Region**：选离你的 Vercel 函数最近的区域。在项目 **Settings → Functions** 里可以看到函数区域，默认一般是美东 `iad1`，那就选美东（US East / Washington, D.C.）。
   - **Name**：随便填，例如 `self-love-ratelimit`。
5. 点 **Create**。完成后会提示把数据库 **Connect** 到项目，**Production**、**Preview**、**Development** 三个环境都勾上，再点 **Connect**。
6. 检查变量是否已注入：进入 **Settings → Environment Variables**，应该能看到下面任意一组变量（两种命名代码都能识别）：
   - `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`
   - 或 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`
7. 环境变量只对**新的部署**生效，所以要重新部署一次：进入 **Deployments**，在最新一次部署右侧的 **⋯** 菜单里选 **Redeploy**。

**另一种方式：直接在 Upstash 官网注册**

在 <https://upstash.com> 注册，创建一个 Redis 数据库，复制 **REST URL** 和 **REST Token**。然后在 Vercel 的 **Settings → Environment Variables** 里手动添加 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`，再 Redeploy。

**验证：** 部署完成后，在网站上提交一次联系表单，然后打开 Upstash 控制台的 **Data Browser**，应该能看到以 `self-love:rl:` 开头的键。如果 Vercel 的日志里出现 `Rate limit store unavailable`，说明变量没配对。

> 本地开发不需要配置 Upstash，会自动使用内存计数。

---

## 第 2 步：让 Shopify Admin token 拥有创建折扣码的权限

**作用：** 推荐奖励需要通过 Shopify Admin API 创建折扣码，要用到 `write_discounts` 权限。你现在的 token 是之前通过网站自带的 OAuth 工具获取的，只有 `read_orders, write_orders, read_products, write_products` 这几项权限，需要重新获取一次。

1. **更新 App 的权限配置。** `shopify.app.toml` 里我已经加好了 `read_discounts, write_discounts`，把配置推送到 Shopify：

   ```bash
   cd 项目目录
   npx shopify app deploy
   ```

   按提示登录 Shopify Partner 账号，选择 **Self Love** 这个 App，确认发布新版本。

   如果不想用命令行：打开 <https://dev.shopify.com>，进入 Self Love 这个 App 的配置页（**Versions** / **Configuration**），在 **Access scopes** 里加上 `read_discounts` 和 `write_discounts`，然后发布新版本。

2. **临时打开 OAuth 工具。** 在本地的 `.env.local` 里加一行：

   ```
   SHOPIFY_OAUTH_SETUP_ENABLED=true
   ```

3. **获取新 token。** 运行 `npm run dev`，在浏览器打开：

   ```
   http://localhost:3000/api/shopify/oauth/start
   ```

   Shopify 会请你确认新增的"折扣"权限，点同意。之后页面会显示一个新的 **Admin token**，把它复制下来。
   这个 token 相当于店铺后台的密码，不要发给任何人。

4. **替换 token。**
   - 把本地 `.env.local` 里的 `SHOPIFY_ADMIN_TOKEN` 改成新 token；
   - 把 Vercel **Settings → Environment Variables** 里 Production 环境的 `SHOPIFY_ADMIN_TOKEN` 也改成新 token；
   - 删掉第 2 小步加的 `SHOPIFY_OAUTH_SETUP_ENABLED=true`。

5. **验证权限**（可选）。把 `你的店铺` 和 `新TOKEN` 换成实际值后运行：

   ```bash
   curl -s -X POST "https://你的店铺.myshopify.com/admin/api/2026-01/graphql.json" \
     -H "X-Shopify-Access-Token: 新TOKEN" -H "Content-Type: application/json" \
     -d '{"query":"{ currentAppInstallation { accessScopes { handle } } }"}'
   ```

   返回结果里应该包含 `write_discounts`。

---

## 第 3 步：确认 Shopify 会在"订单付款"时通知网站

**作用：** 推荐人的奖励是在被推荐人第一笔订单**付款后**发放的，这依赖 Shopify 发来的订单 webhook。

- 如果你的网站上"我的订单"已经能自动出现 Shopify 订单，说明 webhook 已经接好了。只需确认订阅的事件里包含 **Order payment**（`orders/paid`）。
- 如果还没接，在 Shopify 后台 **Settings → Notifications → Webhooks** 里点 **Create webhook**：
  - **Event**：Order payment
  - **Format**：JSON
  - **URL**：`https://你的网站域名/api/shopify/webhook`
  - **API version**：2026-01

  - 通过应用或 Admin API 创建的订阅使用该应用的 client secret 签名；Vercel 的 `SHOPIFY_CLIENT_SECRET` 必须属于创建订阅的同一个应用。
  - 旧版 Shopify Admin 中手动创建的 webhook 可能显示单独的签名密钥（"Your webhooks will be signed with …"）；仅这种订阅需要把该值配置为 `SHOPIFY_WEBHOOK_SECRET`。
  - 部署后必须发送一次真实测试事件，并确认 Shopify delivery 返回 2xx 且订单写入目标 Supabase 项目。仅看到订阅列表不代表验签配置正确。

---

## 第 4 步：分阶段上线（每个生产写操作必须另行授权）

本地修复不等于已上线。当前 Production 最近 READY 来源为 `main/ae977ecf…`，本地为 development，未提交修改不会被 Vercel Redeploy 自动包含。上线前重新确认实际别名指向和 commit，审查本次改动与原有改动后再规划 commit/push；本文不授权这些操作。

### Stage A — Compatibility Release

前置：审核代码、两种数据库测试通过、确认发布来源与真实 Storefront 配置；泄露 token 已撤销/轮换并验证旧 token 失效。该配置写操作需要独立批准，不能延后至兼容发布之后。

操作：发布兼容代码，保持 `REFERRAL_REWARDS_ENABLED` 未配置或 `false`。评论服务端强制 pending；会员任意改分接口取消；旧 signup POST 只验证 referral code，不计账。订单 owner RPC 缺失时只用确认的 Auth 邮箱分页查询。新奖励 RPC/表未部署不会阻止登录或订单同步。

验证：登录、评论提交、商品/购物袋/checkout、会员读取、订单 webhook；新评论写回数据库必须 approved=false。缺少 referrals UNIQUE 时新推荐码创建安全返回 503，已有 code 可读；这是有意限制，Stage B 后恢复。旧数据库仍有原有 RLS 风险，必须完成 Stage B，不能把兼容代码当成完整加固。

失败：保持奖励关闭，修复兼容代码。数据库尚未变化时可回退经过审核的代码；不要开启不安全接口。

### Stage B — Database Backup and Migration

前置：兼容发布已验证；关闭新推荐码创建/奖励促销；验证备份和恢复步骤，生产曾返回 PITR=false 且无已验证恢复点。备份 schema/data/grants/policies/functions/triggers/migration history；Storage 文件单独备份，文件存放在受保护的位置，不提交仓库。

`20260612000000` 已完成 history repair，不再 repair。重新执行只读 catalog 数据预检、migration list 和 dry-run。预期待执行顺序：

1. `20261010000000_security_hardening.sql`
2. `20261014000000_referral_rewards.sql`
3. `20261015000000_production_reconciliation.sql`
4. `20261015000100_referral_delivery.sql`

明确批准后才能执行 `supabase db push`。不可用 `--include-all` 重放历史文件。新增 migration 使用事务和 5 秒 lock timeout；数据冲突会报告表/原因并失败，不清洗数据。CLI 的不同 migration 不构成一个整体事务，失败时先确认哪些版本已提交。

验证：八条已有 approved 评论不变；approved 默认 false；referrer UNIQUE/NOT NULL/CHECK；新表 grants、service-only RPC、RLS；五项 auth FK 保持 NO ACTION。只有缺失项新增，已应用历史文件不修改。

失败：保持兼容发布、奖励关闭，核验已提交版本并前向修复。不得通过恢复危险 grants 解除错误，不删除奖励账本。

### Stage C — Final Application Release

前置：四项 migration 全部验证，最终代码测试通过。操作：部署经审核的最终 commit，奖励仍关闭。验证订单同步、评论本人 pending/他人不可见/管理员审核、referral code 并发、重试任务授权。已有 referrer reward 缺少 canonical 首单证据、孤立 reward 或已 issued 折扣会使可靠性迁移预检停止，必须先人工核验，不能标记 applied 或自动清洗。新处理器不能回退调用旧 `claim_referrer_reward`；该非原子函数 EXECUTE 已撤销。

失败：暂停相关功能并前向修复；回退版本必须兼容已加固 schema，不能直接回到原始 Production API。

### Stage D — Shopify / Upstash / Webhook Configuration

前置：另行批准远端配置操作。先轮换泄露 token 并确认旧 token 失效；OAuth setup 默认关闭。Storefront gift card 和 checkout 另行真实验证。

奖励处理会检查 `read_customers/read_discounts/write_discounts`；Thanks 历史核验还必须有 `read_orders/read_all_orders` 和相应 protected customer data access。不得自动扩大 scopes 或创建 customer。只有唯一、邮箱匹配且 verifiedEmail=true 的已有 Shopify customer 才可绑定；Supabase 邮箱也必须已确认。

如果注册用户尚无 Shopify customer，Welcome 会留在 pending，不会变成全客户优惠码；需要店铺现有合法客户流程建立映射。首单历史必须完整分页读取，最多 2000 笔、每单最多 249 条交易；复杂分次付款/不完整历史/歧义时间进入 manual_review，不推测资格。已退款或取消的候选订单不发奖；已发奖后的退款不自动撤销 Shopify 折扣，需另行业务授权。

配置受保护调度器每 5 分钟调用 `GET /api/cron/referral-rewards`，发送 Bearer CRON_SECRET；不要把 secret 写入 URL。路由 maxDuration=300，需要确认部署平台支持。每次最多一个事件、一个奖励，按实际流量调整经过测试的容量；Vercel Cron 频率受套餐限制，必要时使用获批调度服务。本轮未修改 vercel.json 或远端 scheduler。

持久记录 attempts、next_attempt_at、last_error、5 分钟租约。每阶段最多 8 次自动尝试，退避从 60 秒起；预算耗尽停止，映射/权限不足的奖励保持 pending 并注明原因。人工重试必须审核失败原因、保持同一个 reward ID/code，重置 attempts/next_attempt_at 的生产 DML 另行授权。

Upstash 要验证实际运行时共享键，而非仅变量存在；故障时现有限流仍会退化为单实例计数，需要监控。Webhook 必须验证原始字节 HMAC、店铺、事件 ID，推荐资格只依据 Shopify canonical 历史；重复事件不会重复创建/计账。

验证配置和调度成功后，另行批准设置 `REFERRAL_REWARDS_ENABLED=true`。开关只控制外部发码/发信；已具备 schema 时 callback/webhook 仍可持久排队。旧 schema 的过渡期奖励未启用，早期事件不会自动追补；如需追补，必须单独审核资格与数据回填。

### Stage E — Production Smoke Tests

前置：代码和数据库来源已确认，配置和 scheduler 已验证。只读 smoke 先检查商品/catalog、账号、年龄门、SEO、RLS 和日志；新评论/邮件测试是生产写操作，需要明确批准。真实折扣、付款订单必须说明金额和清理方式并单独批准。

验证受益人限制、重复 webhook、历史首单、失败重试、邮件补发。邮件采用独立状态和固定 Resend idempotency key；提供商幂等窗口及跨系统故障仍可能产生重复邮件，不宣称严格 exactly-once。

失败：关闭奖励开关，保留队列/账本，停止新增付费测试并按实际提交状态恢复。

### 本地复现

- `npm run test:unit`
- `npm run test:migrations`：固定本地 Docker 容器内 clean/drift/conflict 数据库，不连接生产。
- `python3 tests/migrations/verify.py --legacy-api`：仅重建 self-love-e2e 专用本地测试栈为生产 catalog 漂移，无生产数据。
- `npm run test:compatibility`：先重建捕获的 production-drift schema，运行兼容 API 测试（奖励关闭），最后恢复完整本地 migrations。
- 应用四项候选 migration 到该专用本地漂移栈后，再运行全量 API/E2E。
- `supabase db reset --local --no-seed`：重建专用干净测试栈后运行全量；必须显式 --local。

---

## 可选设置

| 环境变量 | 默认值 | 作用 |
|---|---|---|
| `REFERRAL_REWARDS_ENABLED` | `false` | 经配置和调度验证后才开启发码/发信 |
| `REFERRAL_REWARD_AMOUNT` | `10` | 每个折扣码减免的金额（美元） |
| `REFERRAL_REWARD_MIN_SUBTOTAL` | `30` | 使用折扣码的最低订单金额（设为 `0` 表示无门槛） |
| `ORDER_ATTRIBUTION_SECRET` | 无 | 至少 32 个字符；独立签名 Shopify checkout 与本地账号的 7 天归属凭证，不得与 webhook secret 共用 |

推荐入口、营销文案和服务端发放逻辑统一读取服务端变量。不要再配置已废弃的 `NEXT_PUBLIC_REFERRAL_REWARD_*` 变量。
