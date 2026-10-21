# Self Love 网站 —— 自动化测试计划（E2E + AI 驱动）

> 适用代码：`development` 分支（Next.js 16.2 App Router + Supabase + Shopify Storefront/Admin + Resend + Hugging Face + PostHog）
> 目标：**不依赖人工点点点**。所有用例要么写成 Playwright/Vitest 可重复执行的脚本，要么写成 AI Agent（Claude Code + Playwright MCP）可直接执行的「测试章程」，带明确的判定标准（oracle）。

---

## 0. 静态审查已发现的缺陷（先修/先测）

下面这些是通读代码后**已经能确认或高度怀疑**的问题。每条都对应后文的自动化用例 ID，测试的第一要务是把它们**用失败的测试固化下来**（先红后绿）。

### P0 —— 安全 / 资损（上线前必须修）

> **修复状态（2026-10-10，仅在本地完成，尚未部署到线上）：** D01、D02、D03、D06、D07、D08、D33 已通过迁移 `20261010000000_security_hardening.sql` 和对应 API 的改动修复，D19 也随 D07 一并修复。SEC-01~SEC-08 共 43 个测试在 `STRICT=1` 下全部通过。D09（邮件注入 / 钓鱼中继）与 D22（Newsletter 失败仍提示成功）已修复，由 `tests/api/email-injection.spec.ts`（9 个测试）覆盖。D04、D05 已改为使用 Shopify 自带的礼品卡：购买走 Shopify 结账，收件人信息通过官方文档中的礼品卡 line item properties 传递；兑换时把 `giftCardCodes` 传给 Shopify，并以 `appliedGiftCards` 为准。自建的 `/api/gift-card` 已删除。由 `tests/api/gift-card.spec.ts`（15 个测试）和 `tests/e2e/gift-card-cart.spec.ts`（2 个浏览器测试）覆盖，Shopify 由 `tests/mocks/shopify-storefront.ts` 模拟。**上线前需要在真实的 Shopify 开发店铺上手工验证一次：** ① 礼品卡商品已发布到 Headless 渠道；② 通过 Storefront API 传递的收件人属性确实会让 Shopify 把礼品卡发到收件人邮箱；③ 无效的礼品卡码确实不会出现在 `appliedGiftCards` 里。

| ID | 问题 | 位置 | 对应用例 |
|---|---|---|---|
| D01 | `gift_cards` 的 SELECT 策略是 `USING (true)`：任何人用公开的 anon key 直接 `select *` 就能拿到**所有礼品卡 code、余额、收件人邮箱** | [complete_schema.sql:276](../../supabase/migrations/20260613_complete_schema.sql#L276) | SEC-01 |
| D02 | `memberships` 的 UPDATE 策略不限制列：登录用户可直接把自己改成 `tier='gold', points=999999`；`POST /api/membership` 也接受客户端传来的 `points/total_spent` | [complete_schema.sql:78](../../supabase/migrations/20260613_complete_schema.sql#L78)、[membership/route.ts:31](../../src/app/api/membership/route.ts#L31) | SEC-02 |
| D03 | `reviews` 的 INSERT 只检查 `authenticated`：用户可绕过 API 直接插入 `approved=true, verified_purchase=true`、伪造 `nickname`/`user_id`，跳过审核 | [complete_schema.sql:158](../../supabase/migrations/20260613_complete_schema.sql#L158) | SEC-03 |
| D04 | 礼品卡**无需付款即可生成**：`POST /api/gift-card` 直接写库 + 发码；同时它用的是 anon client，而表只有 service_role 能写 → 实际很可能**永远 500**（两种情况都是缺陷，需实测确认） | [gift-card/route.ts:18-91](../../src/app/api/gift-card/route.ts#L18-L91) | API-GC-01..03 |
| D05 | 礼品卡只在前端“显示抵扣”，结账时并未传给 Shopify，用户看到的应付金额 ≠ 实际扣款；余额也从不扣减 | [CartDrawer.tsx:605-640](../../src/components/cart/CartDrawer.tsx#L605)、[store/cart.ts:69](../../src/store/cart.ts#L69) | E2E-CART-08 |
| D06 | `/auth/callback?next=` 开放重定向：`${origin}${next}`，`next=@evil.com` 或 `next=.evil.com` 会跳到外站 | [auth/callback/route.ts:9,37](../../src/app/auth/callback/route.ts#L9) | SEC-06 |
| D07 | `profiles` 允许用户改自己的 `email` 列；webhook 用 `profiles.email ILIKE 订单邮箱` 把订单归属给用户 → 攻击者把 profile 邮箱改成别人的，就能“领走”该邮箱的游客订单（订单、物流、电话）。另外 ILIKE 会把 `_`/`%` 当通配符 | [complete_schema.sql:31](../../supabase/migrations/20260613_complete_schema.sql#L31)、[logistics.ts:227-240](../../src/lib/logistics.ts#L227-L240) | SEC-07 |
| D08 | `POST /api/referral` 无鉴权、无限流、可对任意 code 无限 `uses+1`；用户还能直接 INSERT 自己的 referral 行并自填 `uses/rewards_earned` | [referral/route.ts:41](../../src/app/api/referral/route.ts#L41)、[complete_schema.sql:308](../../supabase/migrations/20260613_complete_schema.sql#L308) | SEC-08 |
| D33 | `reviews` 的 SELECT 策略对已审核评论开放**所有列**：任何人用 anon key 可读出每位评论者的私密联系方式（`email` 列存的是邮箱或手机号）。由 SEC-04 自动化测试发现 | [complete_schema.sql:154](../../supabase/migrations/20260613_complete_schema.sql#L154) | SEC-04 |
| D09 | 邮件 HTML 注入 / 钓鱼中继：contact、gift-card、restock 等模板直接拼接用户输入（name/message/sender_name）；`/api/contact` 会给**任意邮箱**发送带攻击者内容的品牌确认邮件；`/api/newsletter` 完全无限流 | [email.ts](../../src/lib/email.ts)、[gift-card/route.ts:66-83](../../src/app/api/gift-card/route.ts#L66)、[newsletter/route.ts](../../src/app/api/newsletter/route.ts) | SEC-09 |

### 第二轮修复（2026-10-14）

以下缺陷均已在本地修复，并由 `tests/api/fixes.spec.ts`、`tests/e2e/fixes.spec.ts` 和 `tests/e2e/account.spec.ts` 覆盖。全部 193 个测试连续两次通过；对 D11、D12、D18 做过变异测试（临时撤销修复后，对应测试确实失败）。

| 缺陷 | 修复方式 |
|---|---|
| D10 | 定时任务同时接受 `Authorization: Bearer`（Vercel Cron 实际发送的头）和 `x-cron-secret`，并用定长比较 |
| D11 | 开始结账时不再清空购物袋；记录 Shopify cart ID，回到网站时查询该 cart，确认已转成订单才清空 |
| D12 | 退出登录时清空本机购物袋；云端副本保留，下次登录时恢复 |
| D13 | 登录（含 Google）后回到 `redirectTo` 指定的页面；已登录用户访问 `/login` 也会跳回原页面。跳转目标统一经过 `safeRedirectPath` 校验 |
| D14 | 欢迎邮件只发一次，以用户不可修改的 `app_metadata.welcome_email_sent` 作为标记 |
| D15 | 退货请求校验：数量必须是正整数；同一请求内不能重复列出同一件商品；各进行中请求的累计数量不超过购买数量；原因、诉求、商品状态必须是合法枚举；文本有长度上限；商品写入失败时回滚已创建的请求 |
| D16 | 30 天退货期从签收日开始计算 |
| D17 | 退货物流链接只接受 http(s)，页面上只渲染 http(s) 链接；照片路径必须位于用户自己的目录，签名时也会再过滤一次 |
| D18 | 不再编造评分（Shopify 映射和内置目录均已清零）；商品页显示真实的已审核评论均分和条数，没有评论时显示 "No reviews yet"；库存改用 Shopify 的 `availableForSale`，未知数量时不显示虚假的稀缺提示 |
| D20 | 新增 `/api/catalog` 和 `useCatalog()`。搜索、购物袋推荐、最近浏览、收藏移入购物袋都改用实时商品目录；收藏移入购物袋时选择有库存的款式，并使用当前价格 |
| D23 | OAuth 设置工具默认关闭，需要设置 `SHOPIFY_OAUTH_SETUP_ENABLED=true` 才能使用；HMAC 长度不符时返回 401；去掉写死的 client ID 兜底；校验 shop 域名；页面输出做转义并加 noindex |
| D24 | Webhook 收到坏 JSON 时返回 400 |
| D25 | 年龄确认弹窗改为服务端渲染（不开 JS 也能看到，首屏不会闪出内容）；已验证的访客由 `<head>` 内联脚本在首次绘制前隐藏弹窗 |
| D26 | 隐私政策如实说明：AI 预览会把身高范围、体型、肤色经服务器发给 Hugging Face；已登录用户的购物袋会保存在服务器；订单、退货、评论数据的处理方式 |
| D27 | 新增 `robots.txt` 和 `sitemap.xml`；登录、账户、订单、退货、物流页设为 noindex |
| D28 | logo 从 1.7 MB 压缩到 76 KB（256 px） |
| D29 | 商品列表的 Shopify 请求改为缓存 5 分钟，单个商品仍然实时获取 |
| D30 | 首单优惠弹窗在通过年龄确认后才出现；Newsletter 在有阻断式弹窗时等待 |
| D31 | 新增全局错误页 `app/error.tsx` |
| D32 | AI 预览先校验输入再调用服务：长度上限；拒绝涉及未成年人或露骨内容的描述；提示词中固定为成年模特 |
| 无障碍 | 登录、个人资料、地址、联系表单的 label 都与输入框关联；`/login` 增加 h1；年龄确认和搜索面板加 dialog 角色；密码显示按钮和"设为默认地址"复选框补充可读名称 |

**第三轮（2026-10-14）：**
- **D21 已修复：** 配置了 Upstash（`UPSTASH_REDIS_REST_*` 或 Vercel 注入的 `KV_REST_API_*`）后，限流在所有实例间共享；未配置时退回内存计数；Upstash 不可达或超时时同样退回内存计数，不会放行。由 `tests/api/rate-limit.spec.ts` 用 serverless-redis-http 验证。
- **D40 已修复：** 推荐奖励改为 Shopify 折扣码（单次使用、不过期，默认 $10 / 满 $30，可通过环境变量调整）：
  - 新用户确认邮箱后，获得 welcome 折扣码；
  - 被推荐人的第一笔订单付款后，推荐人获得 thanks 折扣码；
  - 两类奖励都可重放、幂等，Shopify 创建失败会自动重试。

  由 `tests/api/referral-rewards.spec.ts` 覆盖。此外修复了推荐页分享链接指向不存在的 `/signup` 的问题。
- **上线前需要配置：** 见 `docs/setup/upstash-and-shopify-discounts.md`。

### E2E 全量运行发现的问题（2026-10-13）

在本地测试环境跑全站 E2E（`npm run test:e2e`，158 个测试）时新发现以下问题，均已修复，并由测试覆盖：

| ID | 问题 | 修复 | 覆盖测试 |
|---|---|---|---|
| D34 | 每个商品页的面包屑都链接到 `/collections/<分类>`（如 corset、panty、bodysuit），但这些集合页一律 404 | 目录中存在的商品分类视为合法集合（`getCollectionByHandle`） | smoke：内部链接检查 |
| D35 | 首页轮播、购物车空状态、新手任务、每日奖励里的 `/products/lace-halter-babydoll-set` 指向不存在的商品（404） | 统一改用 `src/lib/featured.ts` 中的 `TRY_ON_PRODUCT_PATH` | smoke：内部链接检查 |
| D36 | 顶部和底部导航的购物袋数量角标在加购后不更新（订阅的是函数引用，组件不会重新渲染） | 改为订阅商品数量 | shopping：加购旅程 |
| D37 | 没有保存过购物车的已登录用户，每次加载页面都会收到 406，控制台报错（`.single()`） | 改为 `.maybeSingle()` | smoke：账户页 |
| D38 | CSP 的 `connect-src` 写死为 `*.supabase.co` 和美区 PostHog，不跟随环境变量配置 | 从 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_POSTHOG_HOST` 读取并加入 | 所有登录相关 E2E |
| D39 | 无障碍：多个纯图标按钮没有可读名称（搜索、购物袋、数量加减、删除）；购物袋抽屉和搜索面板没有 `role="dialog"` | 已补 `aria-label` / `role="dialog"` | shopping |

**仍未修复：**
- **D13：** 登录后不会回到原来的页面。由 `account.spec.ts` 以 knownDefect 标记。
- **无障碍：** 登录、个人资料、地址表单的 `<label>` 没有和输入框关联（缺少 `htmlFor`/`id`）；`/login` 页没有 `<h1>`。
- **风险：** 搜索、购物车推荐、分类预览只使用内置的 `MOCK_PRODUCTS`，Shopify 里新增的商品不会出现在搜索结果中。

### P1 —— 功能缺陷

| ID | 问题 | 位置 | 对应用例 |
|---|---|---|---|
| D10 | Vercel Cron 发送的是 `Authorization: Bearer <CRON_SECRET>`，代码却读 `x-cron-secret` → 线上弃购邮件**永远 401** | [cron/abandoned-cart/route.ts:19](../../src/app/api/cron/abandoned-cart/route.ts#L19) | API-CRON-01 |
| D11 | 点击结账先 `clearCart()` 再跳转 Shopify；用户在 Shopify 放弃支付后回来购物车是空的，2 秒后云端快照也被删，弃购邮件也失去意义 | [CartDrawer.tsx:54](../../src/components/cart/CartDrawer.tsx#L54) | E2E-CART-07 |
| D12 | 退出登录不清空本地购物车；同一台设备换账号登录，上一个人的（私密）商品会被合并进新账号 | [CartSyncProvider.tsx:72-75](../../src/components/cart/CartSyncProvider.tsx#L72) | E2E-AUTH-07 |
| D13 | 登录页忽略 `redirectTo`，登录后永远去 `/account` | [login/page.tsx:46](../../src/app/(account)/login/page.tsx#L46) | E2E-AUTH-04 |
| D14 | 欢迎邮件判断 `user_metadata.email_confirmed_at`（该字段从不存在）→ 每次 OAuth/邮件链接回调都会重发欢迎邮件 | [auth/callback/route.ts:33](../../src/app/auth/callback/route.ts#L33) | E2E-AUTH-06 |
| D15 | 退货数量只校验上限：`quantity=0/-1/1.5` 能通过；同一商品可重复发起多次退货，累计数量不受限；`trackingNumber` 缺失时抛 `TypeError` 原文给前端 | [returns.ts:154](../../src/lib/returns.ts#L154)、[returns.ts:350](../../src/lib/returns.ts#L350) | API-RET-03..06 |
| D16 | 退货 30 天窗口按下单时间算，文案写的是“按签收时间” | [returns.ts:130,148](../../src/lib/returns.ts#L130) | UNIT-RET-04 |
| D17 | `return_tracking_url` 未校验协议直接作为 `<Link href>` 渲染（`javascript:` 链接）；`media_urls` 由客户端提交、服务端用 admin 权限签名任意路径 | [returns/[id]/page.tsx:182](../../src/app/(account)/returns/[id]/page.tsx#L182)、[returns.ts:223](../../src/lib/returns.ts#L223) | SEC-10 |
| D18 | Shopify 商品评分写死 `rating: 4.7`、`reviewCount: 0`；库存拿不到时默认 `50` → 页面显示假评分，缺货永远检测不到 | [products.ts:153,170](../../src/lib/products.ts#L153) | E2E-PDP-06 |
| D19 | `getUserIdForEmail` 只查 `listUsers` 第一页 100 个用户，用户量 > 100 后订单无法关联到账号 | [logistics.ts:237](../../src/lib/logistics.ts#L237) | INT-WH-05 |
| D20 | 购物车推荐、Fit 结果全部基于 `MOCK_PRODUCTS`，接入 Shopify 真实商品后推荐为空/错位 | [CartDrawer.tsx:120-160](../../src/components/cart/CartDrawer.tsx#L120) | E2E-CART-09 |
| D21 | 限流是进程内 `Map`，Serverless 多实例下基本无效；`gift-card` 直接用原始 `x-forwarded-for` 当 key，可伪造 | [rate-limit.ts](../../src/lib/rate-limit.ts)、[gift-card/route.ts:19](../../src/app/api/gift-card/route.ts#L19) | SEC-11 |
| D22 | Newsletter 前端无论接口成功失败都显示“订阅成功” | [NewsletterSlide.tsx:57-64](../../src/components/ui/NewsletterSlide.tsx#L57) | E2E-MKT-02 |
| D23 | `oauth/callback` 中 `timingSafeEqual` 遇到长度不同的 hmac 会抛异常 → 500；client_id 有硬编码兜底值 | [oauth/callback/route.ts:23,55](../../src/app/api/shopify/oauth/callback/route.ts#L23) | API-OAUTH-02 |
| D24 | Webhook 签名校验通过后 `JSON.parse` 在 try 外，坏 JSON → 500 | [webhook/route.ts:23](../../src/app/api/shopify/webhook/route.ts#L23) | INT-WH-04 |

### P2 —— 合规 / 体验 / 性能

| ID | 问题 | 对应用例 |
|---|---|---|
| D25 | 年龄门是纯客户端组件：SSR HTML、无 JS 访问、爬虫都能直接看到全部内容；首屏会先闪出内容 | E2E-GATE-03 |
| D26 | 隐私政策写“AI 预览不与第三方共享”，实际把身体描述发给了 Hugging Face | COMP-01 |
| D27 | 无 `robots.ts` / `sitemap.ts`；`/track/[token]`、`/account` 等私密页面没有 `noindex`；全站 `robots: index` | SEO-01..03 |
| D28 | `public/logo.png` 1.7 MB，出现在年龄门、登录页、所有邮件中 | PERF-02 |
| D29 | PDP 每次请求都 `no-store` 拉取 100 个商品来算相关推荐 | PERF-03 |
| D30 | 年龄门 / Cookie 横幅 / 首单免费弹窗 / Newsletter 滑入 四个浮层可能同时叠加 | E2E-GATE-04 |
| D31 | 没有 `error.tsx` / `loading.tsx`，没有任何测试框架；CI 只做 tsc + lint + build | — |
| D32 | AI 预览允许游客调用（成本），`bodyDescription` 直接拼进 prompt，无内容审核 | SEC-12 |

> 当前基线：`npx tsc --noEmit` 通过；`npm run lint` 0 error / 1 warning（profile/page.tsx:39 hook 依赖）。

---

## 1. 测试架构

```
┌────────────────────────────────────────────────────────────────┐
│ L4  AI 探索测试   Claude Code + Playwright MCP，按“测试章程”执行   │  ← 找未知缺陷
├────────────────────────────────────────────────────────────────┤
│ L3  E2E 浏览器    Playwright（Chromium/WebKit/移动端视口）         │  ← 用户旅程
├────────────────────────────────────────────────────────────────┤
│ L2  API/集成/RLS  Playwright request + supabase-js (anon/用户/admin)│  ← 权限与接口契约
├────────────────────────────────────────────────────────────────┤
│ L1  单元          Vitest（纯函数：退货资格、分类、映射、购物车）     │  ← 业务规则
└────────────────────────────────────────────────────────────────┘
外部依赖（Shopify / Resend / Hugging Face / PostHog）全部在测试环境 mock。
```

### 1.1 工具选型

| 用途 | 工具 | 说明 |
|---|---|---|
| 单元测试 | `vitest` | 只测纯函数，毫秒级 |
| E2E + API 测试 | `@playwright/test` | 同一套框架既跑浏览器又跑 HTTP |
| 数据库 / RLS | `supabase` CLI 本地栈（`supabase start`） | 每次测试用干净库，跑全部 migrations |
| 服务端外部请求 mock | `msw`（Node 模式，通过 Next `instrumentation.ts` 在 `E2E=1` 时启动） | Playwright 的 `page.route` 只能拦浏览器请求，拦不到 Route Handler 里的 `fetch`，所以必须在服务端 mock |
| 可访问性 | `@axe-core/playwright` | 每个关键页面跑一次 |
| 性能 | Lighthouse CI（`@lhci/cli`） | 首页 / PDP / 集合页 |
| AI 探索 | Claude Code + Playwright MCP（`@playwright/mcp`） | 见第 5 节 |

### 1.2 需要安装的依赖

```bash
npm i -D @playwright/test @axe-core/playwright vitest msw @lhci/cli
npx playwright install --with-deps chromium webkit
npm i -D supabase   # 或 brew install supabase/tap/supabase
```

`package.json` 增加：

```json
"scripts": {
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "db:test:reset": "supabase db reset --local && tsx tests/seed/seed.ts"
}
```

### 1.3 目录结构

```
tests/
  unit/                 # Vitest
    returns.eligibility.test.ts
    logistics.classify.test.ts
    products.map.test.ts
    cart.store.test.ts
  api/                  # Playwright request 测试（不开浏览器）
    security.rls.spec.ts
    gift-card.spec.ts
    returns.spec.ts
    reviews.spec.ts
    webhook.spec.ts
    ...
  e2e/                  # 浏览器旅程
    age-gate.spec.ts
    browse.spec.ts
    pdp.spec.ts
    cart-checkout.spec.ts
    auth.spec.ts
    account.spec.ts
    returns.spec.ts
    tracking.spec.ts
    marketing.spec.ts
    a11y.spec.ts
  fixtures/
    auth.ts             # 登录态 fixture
    supabase.ts         # anon / user / admin client 工厂
    shopify-payloads/   # webhook JSON 样本
  mocks/
    handlers.ts         # MSW：Shopify Storefront/Admin、Resend、HF
    outbox.ts           # 记录“已发送邮件”，供测试断言
  seed/
    seed.ts             # 测试用户、订单、发货、退货数据
  ai/
    charters/           # AI 探索章程（第 5 节）
    reports/            # AI 产出的缺陷报告
```

---

## 2. 测试环境

### 2.1 `.env.test`

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start 输出的 anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase start 输出的 service_role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3100

# Shopify：留占位值 => 走 MOCK_PRODUCTS 模式；设为 mock 域名 => 走 MSW 模拟的 Storefront API
NEXT_PUBLIC_SHOPIFY_DOMAIN=e2e-store.myshopify.com
NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=e2e-storefront-token
SHOPIFY_ADMIN_TOKEN=e2e-admin-token
SHOPIFY_WEBHOOK_SECRET=e2e-webhook-secret
SHOPIFY_CLIENT_SECRET=e2e-client-secret

RESEND_API_KEY=re_e2e_dummy
RESEND_FROM_EMAIL=Self Love <test@example.com>
CONTACT_RECIPIENT_EMAIL=owner@example.com
HF_TOKEN=hf_e2e_dummy
CRON_SECRET=e2e-cron-secret
NEXT_PUBLIC_POSTHOG_KEY=          # 留空，关闭埋点
E2E=1
```

> 必须用**本地 Supabase**，不要连 `.env.local` 里的线上项目：SEC 用例会主动尝试越权写数据。

### 2.2 服务端 mock（MSW）

新增 `src/instrumentation.ts`（Next 16 支持；先读 `node_modules/next/dist/docs/` 中 instrumentation 一节确认 API）：

```ts
export async function register() {
  if (process.env.E2E === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { server } = await import('../tests/mocks/node');
    server.listen({ onUnhandledRequest: 'bypass' }); // 放行 127.0.0.1:54321 Supabase
  }
}
```

`tests/mocks/handlers.ts` 需要覆盖：

| 外部服务 | 拦截地址 | mock 行为 |
|---|---|---|
| Shopify Storefront | `https://e2e-store.myshopify.com/api/2026-01/graphql.json` | 根据 `query` 名返回固定商品/集合；`cartCreate` 返回 `checkoutUrl: http://localhost:3100/__mock_checkout?cart=...` |
| Shopify Admin | `https://e2e-store.myshopify.com/admin/api/2026-01/graphql.json` | `orders` 查询、`tagsAdd/metafieldsSet` 返回成功；可通过 header 切换为失败 |
| Resend | `https://api.resend.com/emails` | 把请求体写进 `outbox`（内存 + `GET /__test/outbox` 暴露），返回 `{id}` |
| Hugging Face | `https://router.huggingface.co/**` | 返回 1×1 PNG；可切换 503/401/超时场景 |

用 `__test` 路由（仅 `E2E=1` 时启用）暴露：`GET /__test/outbox`、`POST /__test/outbox/clear`、`POST /__test/mock-mode`（切换 HF/Shopify 的故障模式）。

### 2.3 种子数据（`tests/seed/seed.ts`，用 service_role）

| 实体 | 内容 |
|---|---|
| 用户 | `alice@test.local`（已验证）、`bob@test.local`（已验证）、`carol@test.local`（未验证），密码统一 `Test1234!` |
| 订单 | Alice：`#1001` 已签收 5 天（含 1 件内衣 `thong`、1 件 `stocking`、1 件普通睡裙 qty=2）；`#1002` 已签收 45 天；`#1003` 未发货；`#1004` 已发货未签收。Bob：`#2001` |
| 游客订单 | `guest@test.local` 的 `#3001`（user_id = null） |
| 发货 | `#1001` 有 `public_lookup_token = tok_alice_1001` |
| 礼品卡 | `GC01-AAAA-BBBB-CCCC` 余额 50；已过期卡；余额 0 卡 |
| 评论 | 某商品 2 条 approved、1 条 Alice 的 pending |

每个 spec 文件在 `beforeAll` 里调用 `db:test:reset` 级别的重置，或使用事务隔离（推荐按 spec 文件重置，简单可靠）。

### 2.4 Playwright 配置要点

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: ['api/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  fullyParallel: false,               // 共享一个本地 DB，先串行，稳定后再按 worker 分库
  retries: process.env.CI ? 1 : 0,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'api', testMatch: /api\/.*\.spec\.ts/, dependencies: ['setup'] },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] }, testMatch: /e2e\/.*/, dependencies: ['setup'] },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] }, testMatch: /e2e\/(age-gate|browse|pdp|cart-checkout)\.spec\.ts/, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100',
    env: { E2E: '1' },
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2.5 通用 fixture

- **年龄门**：所有 E2E（除 `age-gate.spec.ts`）在 `context.addCookies` 预置 `velour_age_verified=1`，并在 `addInitScript` 里写 `localStorage.velour_cookie_consent_v1='denied'`、关闭 Newsletter/首单弹窗的 localStorage key，避免浮层干扰。
- **登录态**：`auth.setup.ts` 通过 `/login` 表单登录 Alice、Bob，保存 `storageState` 到 `tests/.auth/alice.json`、`bob.json`。
- **Supabase 客户端工厂**（API/RLS 测试用）：
  ```ts
  export const anon = () => createClient(URL, ANON_KEY);
  export async function asUser(email: string) {
    const c = createClient(URL, ANON_KEY);
    await c.auth.signInWithPassword({ email, password: 'Test1234!' });
    return c;
  }
  export const admin = () => createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  ```
- **Webhook 签名**：
  ```ts
  export function signShopify(body: string) {
    return crypto.createHmac('sha256', 'e2e-webhook-secret').update(body, 'utf8').digest('base64');
  }
  ```
- **稳定选择器**：优先用 `getByRole` / `getByLabel`（对 AI 也最友好）。对图标按钮（购物车 +/-、删除、心形收藏）补 `aria-label`，必要时加 `data-testid`。这本身也是可访问性修复。

---

## 3. 测试用例清单

格式：**ID｜场景｜步骤｜预期（oracle）**。标注 `[D0x]` 的用例在修复前**预期失败**，用 `test.fail()` 标记，修复后去掉。

### 3.1 L1 单元测试（Vitest）

| ID | 目标 | 用例要点 |
|---|---|---|
| UNIT-RET-01 | `evaluateEligibility`（需从 returns.ts 导出） | 未发货 + `cancel_order` → `eligible`；已发货 + `cancel_order` → `review_required` |
| UNIT-RET-02 | 内衣卫生规则 | `return_category=underwear` + `changed_mind` → `ineligible`；+ `wrong_item` → 非 ineligible |
| UNIT-RET-03 | 丝袜规则 | hosiery + `damaged` + 非商家责任 → `ineligible` |
| UNIT-RET-04 [D16] | 30 天窗口 | 下单 40 天前、签收 10 天前 → 应 **可退**（当前实现会判不可退） |
| UNIT-RET-05 | 商家责任需图片 | `quality_issue` 无图 → notes 含 “photos are required”，状态 `review_required` |
| UNIT-RET-06 [D15] | 数量边界 | quantity = 0、-1、1.5、超出 → 均应拒绝 |
| UNIT-LOG-01 | `classifyReturnCategory` | `"Lace Thong"`→underwear，`"丁字裤"`→underwear，`"Fishnet Stockings"`→hosiery，`"Babydoll"`→general，`"Bodystocking"` 不应误判为 hosiery（需确认期望） |
| UNIT-LOG-02 | `normalizeShipmentStatus` | delivered / failure / in_transit / 有单号无状态 / 空 |
| UNIT-PRD-01 | `mapShopifyProduct` | 尺码归一化（`one size`→Free Size，`2XL`→?）、颜色 hex、`compareAtPrice<=price` 时为 undefined |
| UNIT-PRD-02 [D18] | 库存缺失 | `quantityAvailable=null` 时不应伪造为 50（期望 `undefined` 并在 UI 隐藏库存提示） |
| UNIT-PRD-03 | `collectionFilter` | 每个 handle 至少 1 个正例 1 个反例 |
| UNIT-CART-01 | `useCartStore` | 同 variant 合并数量；`updateQuantity(0)` 删除；`effectiveTotal` 不为负 |
| UNIT-CART-02 | 数量上限 | 加购数量不应超过 `stock`（当前无限制，作为需求确认点） |
| UNIT-FIT-01 | `fit-calculator.ts` | 边界身材值、缺字段、单位换算 |
| UNIT-RL-01 | `rateLimit` | 第 N+1 次被拒；窗口过期后恢复 |

### 3.2 L2 安全 / RLS 测试（最高优先级）

直接用 supabase-js 以不同身份访问数据库，**不经过 Next.js**，验证数据库本身的防线。

| ID | 场景 | 步骤 | 预期 |
|---|---|---|---|
| SEC-01 [D01] | 匿名枚举礼品卡 | `anon().from('gift_cards').select('*')` | 返回 0 行或报错；**不得**返回 code/余额/邮箱 |
| SEC-02 [D02] | 自提会员等级 | `asUser(alice).from('memberships').update({tier:'gold',points:999999}).eq('user_id',aliceId)`；以及 `POST /api/membership {points:999999,total_spent:9999}` | 两种方式都不能改变 tier/points |
| SEC-03 [D03] | 绕过评论审核 | `asUser(alice).from('reviews').insert({..., approved:true, verified_purchase:true, user_id:bobId})` | 插入被拒，或 `approved/verified_purchase` 被强制为 false、`user_id` 被强制为本人 |
| SEC-04 | 跨用户读取 | Alice 读 Bob 的 orders / addresses / wishlists / cart_snapshots / return_requests | 均为 0 行 |
| SEC-05 | 跨用户写入 | Alice `update addresses set ... where id=<Bob 的地址>`；`delete wishlists where user_id=bob` | 影响 0 行 |
| SEC-06 [D06] | 开放重定向 | 依次请求 `/auth/callback?code=<有效>&next=@evil.com`、`next=.evil.com`、`next=//evil.com`、`next=https://evil.com`（`maxRedirects:0`） | `Location` 的 host 必须是本站 |
| SEC-07 [D07] | 劫持游客订单 | Alice 把 `profiles.email` 改成 `guest@test.local` → 发送 `orders/create` webhook（guest 邮箱）→ Alice 访问 `/orders` | Alice **看不到**该订单；另：profile 邮箱不应可被用户改写，或订单归属应以 `auth.users` 已验证邮箱为准 |
| SEC-07b | ILIKE 通配符 | 用户邮箱 `a_b@x.com`，订单邮箱 `axb@x.com` | 不应关联 |
| SEC-08 [D08] | 推荐码刷量 | 匿名对同一 code `POST /api/referral` 50 次；`asUser(alice).from('referrals').insert({code:'X', uses:999, rewards_earned:999})` | 应被限流/鉴权；直插不允许自定义 uses/rewards |
| SEC-09 [D09] | 邮件注入 | `POST /api/contact` name=`<a href="https://evil">Click</a>`、email=受害人；`POST /api/gift-card` message 含 `<script>`/`<img>` | outbox 中 HTML 已转义；确认邮件不应包含未转义的用户输入 |
| SEC-10 [D17] | 退货链接与媒体 | `POST /api/returns/<id>/tracking {trackingUrl:"javascript:alert(1)"}`；`POST /api/returns {mediaUrls:["<bob的uid>/x.jpg"]}` | 拒绝非 http(s) URL；只允许签名 `${userId}/` 前缀下的路径 |
| SEC-11 [D21] | 限流可绕过 | `/api/gift-card` 每次换 `X-Forwarded-For` 发 10 次 | 不应全部成功（需求：基于可信 IP 或 Upstash/Redis 限流） |
| SEC-12 [D32] | AI 预览滥用 | 游客调用 `/api/ai-preview`；`bodyDescription` 含露骨词 | 需求确认：是否要求登录 + 输入审核；至少应 400 拒绝明显违规输入 |
| SEC-13 | 受保护路由 | 未登录访问 `/account`、`/account/*`、`/orders`、`/orders/<id>`、`/returns/<id>` | 302 到 `/login?redirectTo=...` |
| SEC-14 | IDOR 页面 | Alice 访问 Bob 的 `/orders/<bobOrderId>`、`/returns/<bobReturnId>` | 404 |
| SEC-15 | 存储桶 | 匿名上传到 `ugc`；Alice 上传到 `returns/<bobId>/x.jpg`；Alice 上传 `.html`/20MB 文件到 `ugc/reviews/` | 前两者拒绝；第三项应有类型/大小限制（Supabase bucket 配置 `allowed_mime_types`、`file_size_limit`） |
| SEC-16 | 安全响应头 | 任意页面 | 存在 CSP、`X-Frame-Options: DENY`、HSTS、`nosniff`；控制台无 CSP 违规（PostHog 域名与 `NEXT_PUBLIC_POSTHOG_HOST` 一致） |
| SEC-17 | 服务端密钥泄漏 | 抓取所有 `/_next/static/**/*.js` | 不包含 `SUPABASE_SERVICE_ROLE_KEY`、`SHOPIFY_ADMIN_TOKEN`、`RESEND_API_KEY`、`HF_TOKEN` 的值 |
| SEC-18 | 订单查询枚举 | `/api/logistics/track` 用正确单号 + 错误邮箱、错误单号 + 正确邮箱 | 均 404，且返回体/耗时无差异；响应不含 email/phone/地址 |

### 3.3 L2 API 契约测试

每个接口至少覆盖：正常、缺字段、类型错误、非 JSON body、未登录、越权、限流。

| ID | 接口 | 关键用例 |
|---|---|---|
| API-GC-01 [D04] | `POST /api/gift-card` | 合法请求 → 当前预期：要么 500（RLS 拒写），要么在**无付款**情况下生成卡。两者都记为缺陷；期望行为：必须经 Shopify 付款后（webhook）才发卡 |
| API-GC-02 | `POST /api/gift-card` | amount = 9 / 501 / `"100"` 字符串 / NaN / 缺失 → 400；`recipient_email="@"` → 应 400（当前只校验 includes('@')） |
| API-GC-03 | `GET /api/gift-card?code=` | 有效卡返回余额；过期 → 400；余额 0 → 400；小写 code 能查到；**连续 100 次错误 code 应被限流**（当前无限流） |
| API-MEM-01 | `GET/POST /api/membership` | 未登录 401；POST 任意值不应改变等级（见 SEC-02） |
| API-REF-01 | `GET /api/referral` | 首次生成 `SL-XXXXXX-XXXX`；二次返回同一个；并发 2 次只生成 1 条 |
| API-REV-01 | `POST /api/reviews` | 未登录 401；rating 0/6/4.5 → 400；正文 9 字符 / 301 字符 → 400；4 张图 → 400；成功后返回 `pending:true` |
| API-REV-02 | `GET /api/reviews` | 匿名只看到 approved；Alice 能额外看到自己的 pending，看不到 Bob 的 pending；响应中**不含** `email` 字段 |
| API-REV-03 | `GET /api/reviews` | 邮箱含 `,` `(` `)` 的用户（PostgREST `or()` 语法注入）不会报错或越权 |
| API-RET-01 | `POST /api/returns` | 未登录 401；Bob 的 orderId → “Order not found”；他人订单的 orderItemId → 拒绝 |
| API-RET-02 | `POST /api/returns` | `#1003` 未发货 + cancel_order → eligible/submitted；`#1001` 内衣 + changed_mind → rejected |
| API-RET-03 [D15] | 数量 | quantity 0 / -1 / 1.5 / 99 → 400 |
| API-RET-04 [D15] | 重复退货 | 同一 orderItem 连续提交两次全量退货 → 第二次应拒绝 |
| API-RET-05 | 非法枚举 | `reason:"foo"` → 400 且错误信息友好（当前会把 Postgres check 约束原文抛出） |
| API-RET-06 [D15] | 物流单号 | 状态非 approved 时提交 → 400；缺 `trackingNumber` → 友好 400 而非 `Cannot read properties of undefined` |
| API-RET-07 | 取消退货 | submitted → closed；再次取消 → 400；Bob 取消 Alice 的 → 400 not found |
| API-TRK-01 | `POST /api/logistics/track` | token 正确 → 200；单号+邮箱（大小写、带 `#`、前后空格）→ 200；只给单号 → 404；第 13 次 → 429 |
| API-RS-01 | `POST /api/restock-notify` | 缺字段 400；重复订阅返回 `duplicate:true`；邮箱大小写归一 |
| API-CT-01 | `POST /api/contact` | 缺字段 400；2001 字符 400；第 4 次 429；成功后 outbox 有 2 封（通知+确认） |
| API-NL-01 [D22] | `POST /api/newsletter` | 非法邮箱 400；Resend 失败时返回 500（且前端应显示失败） |
| API-EM-01 | `POST /api/email` | 未登录 401；未知 type 400；`wishlist_reminder` 的 productTitle 含 HTML 被转义 |
| API-CART-01 | `POST /api/shopify/cart` | 合法 GID → 返回 checkoutUrl；全是本地 mock id 且无法解析 → 400 友好提示；quantity 0/负数/1000 → 应拒绝或由 Shopify userErrors 返回 422 |
| API-AI-01 | `POST /api/ai-preview` | 无 HF_TOKEN → 503；缺字段 400；HF 503 → 重试后 503；HF 401 → 503；成功 → `data:image/png;base64` |
| API-CRON-01 [D10] | `GET /api/cron/abandoned-cart` | 无 header → 401；`Authorization: Bearer e2e-cron-secret`（Vercel 实际格式）→ **应 200**；种子 25 小时前的快照 → 发 1 封、`reminder_sent=true`；再跑一次 → 0 封 |
| API-OAUTH-01 | `/api/shopify/oauth/start` | `shop=evil.com` → 400；合法 shop → 302 到 `https://<shop>/admin/oauth/authorize` 且设置 state cookie |
| API-OAUTH-02 [D23] | `/api/shopify/oauth/callback` | state 不匹配 → 400；hmac 长度错误 → 应 401 而非 500；**确认此路由是否应在生产环境存在**（它会把 Admin Token 明文渲染在页面上） |

### 3.4 L2 集成：Shopify Webhook

| ID | 场景 | 预期 |
|---|---|---|
| INT-WH-01 | 无签名 / 错签名 | 401 |
| INT-WH-02 | `orders/create`（Alice 邮箱，大写） | orders + order_items 落库，`user_id=alice`，内衣行 `return_category=underwear` |
| INT-WH-03 | 同一 payload 重放 3 次 | 订单/明细不重复；发货邮件只发 1 封（查 `notification_logs` + outbox） |
| INT-WH-04 [D24] | 签名正确但 body 非 JSON | 400，而非 500 |
| INT-WH-05 [D19] | 种子 150 个用户，订单邮箱属于第 120 个且无 profile | 订单仍能关联到该用户 |
| INT-WH-06 | `fulfillments/create` 早于 `orders/create` 到达 | 不报错（返回 200 并忽略或排队）；订单后到时发货信息不丢 |
| INT-WH-07 | `fulfillments/update` 状态 in_transit → delivered | shipment.status 更新，事件时间线追加 1 条，不重复 |
| INT-WH-08 | 未知 topic | 200 `received:true` |

### 3.5 L3 E2E 浏览器旅程

#### 年龄门 / 浮层
| ID | 场景 | 预期 |
|---|---|---|
| E2E-GATE-01 | 新访客打开首页 | 显示 “Adults Only” 对话框；点击确认后消失，cookie `velour_age_verified=1` 有效 30 天 |
| E2E-GATE-02 | 点击拒绝 | 跳转离开本站 |
| E2E-GATE-03 [D25] | `javaScriptEnabled:false` 访问首页 / PDP | 不应直接看到商品图片（需求：服务端判断 cookie 后渲染门页） |
| E2E-GATE-04 [D30] | 新访客首次访问，等待 5 秒 | 同一时刻最多 1 个模态浮层；年龄门在最上层且可键盘聚焦 |
| E2E-GATE-05 | 年龄门焦点 | 打开时焦点在对话框内，Tab 不会跑到背后页面（focus trap），有 `role=dialog` |

#### 浏览 / 搜索
| ID | 场景 | 预期 |
|---|---|---|
| E2E-BRW-01 | 首页 | 轮播可切换；“新品”“热卖”区块有商品；所有商品卡链接 200 |
| E2E-BRW-02 | 遍历 Header/Footer/MobileBottomNav 所有链接 | 无 404、无 500；`/pages/*` 全部可访问 |
| E2E-BRW-03 | 集合页 `/collections/<每个 handle>` | 有商品或有空态文案；筛选/排序后商品数量与顺序正确（价格升序校验） |
| E2E-BRW-04 | 不存在的集合 / 商品 | 渲染 not-found 页，HTTP 404 |
| E2E-BRW-05 | 搜索弹窗 | 输入关键词出结果；无结果有空态；Esc 关闭；结果点击跳到 PDP |
| E2E-BRW-06 | `/sale` | 每个商品都显示原价划线且 `compareAtPrice > price` |
| E2E-BRW-07 | 快速查看 | 选尺码颜色→加购→购物车打开且条目正确；缺货组合按钮禁用 |
| E2E-BRW-08 | 最近浏览 | 浏览 3 个 PDP 后首页“最近浏览”按时间倒序出现 |

#### 商品详情页
| ID | 场景 | 预期 |
|---|---|---|
| E2E-PDP-01 | 图库 | 缩略图切换主图；移动端可滑动 |
| E2E-PDP-02 | 变体选择 | 未选尺码时加购按钮禁用或提示；选完后价格/库存提示更新 |
| E2E-PDP-03 | 数量 | 减到 1 不能再减；加到库存上限不能再加 |
| E2E-PDP-04 | 缺货变体 | 显示“到货通知”表单；提交后成功提示；重复提交提示已订阅 |
| E2E-PDP-05 | 尺码指南 | 打开/关闭模态；内容与 `/pages/size-guide` 一致 |
| E2E-PDP-06 [D18] | 评分展示 | 星级与评论数来自真实评论；无评论时不显示 4.7 |
| E2E-PDP-07 | Fit Advisor | 填身材资料→显示推荐尺码；刷新后仍保留（localStorage）；清除后消失 |
| E2E-PDP-08 | AI 预览 | 点击生成→加载态→出图（mock）；HF 503 时显示友好错误；连点 3 次触发 429 提示 |
| E2E-PDP-09 | 收藏 | 未登录点心形→跳登录；登录后收藏→`/account/wishlist` 可见；再次点击取消 |

#### 评论
| ID | 场景 | 预期 |
|---|---|---|
| E2E-REV-01 | 未登录 | 显示“登录后评论” |
| E2E-REV-02 | Alice 提交 5 星 + 2 张图 | 提示待审核；自己可见带“待审核”标记；Bob 和游客看不到 |
| E2E-REV-03 | 前端校验 | 0 星、<10 字、>300 字、第 4 张图、第 2 个视频都被拦截且有提示 |
| E2E-REV-04 | 匿名评论 | 公开昵称为 “Anonymous shopper”，页面任何地方不出现邮箱 |
| E2E-REV-05 | 已审核评论 | 管理员（admin client）批准后，游客可见；图片可点开 lightbox，Esc 关闭 |

#### 购物车 / 结账
| ID | 场景 | 预期 |
|---|---|---|
| E2E-CART-01 | 加购同一变体两次 | 一行，数量 2；徽标数量 = 2 |
| E2E-CART-02 | 加减删 | 小计实时正确（逐行 price×qty 求和，误差 0） |
| E2E-CART-03 | 刷新页面 | 购物车保留 |
| E2E-CART-04 | 登录同步 | 游客加购 A → 登录（云端已有 B）→ 购物车 = A+B；换设备（新 context）登录 → 看到 A+B |
| E2E-CART-05 | 结账 | 点“Go to checkout”→ 跳到 mock checkoutUrl；请求体中的 lines 与购物车一致 |
| E2E-CART-06 | 结账失败 | mock Shopify 返回 userErrors → 显示错误，购物车不清空 |
| E2E-CART-07 [D11] | 放弃支付后返回 | 浏览器后退回到站点 → 购物车**仍然存在** |
| E2E-CART-08 [D05] | 礼品卡 | 应用 `GC01-...` → 显示抵扣；结账请求中**必须携带**礼品卡（或 UI 不得显示抵扣后金额）；过期卡/余额 0 卡提示错误 |
| E2E-CART-09 [D20] | Shopify 模式推荐 | 使用 MSW Shopify 商品时，购物车推荐区有内容且链接有效 |
| E2E-CART-10 | 空购物车 | 显示空态引导，收藏列表（已登录时）可见 |
| E2E-CART-11 | 移到收藏 | 购物车条目“移到收藏”→ 条目消失、wishlist 新增 |

#### 账户 / 认证
| ID | 场景 | 预期 |
|---|---|---|
| E2E-AUTH-01 | 注册 | 填表→提示查收邮件；Supabase 中用户存在，profile + membership 触发器生成行 |
| E2E-AUTH-02 | 登录 | 错误密码→错误提示；正确→/account |
| E2E-AUTH-03 | 已登录访问 /login | 重定向到 /account |
| E2E-AUTH-04 [D13] | 带 redirectTo 登录 | 未登录访问 `/orders` → 登录 → **回到 /orders** |
| E2E-AUTH-05 | 退出登录 | 受保护页不可访问；Header 状态更新 |
| E2E-AUTH-06 [D14] | 回调重复欢迎邮件 | 同一用户两次走 `/auth/callback` → outbox 只有 1 封欢迎邮件 |
| E2E-AUTH-07 [D12] | 共享设备隐私 | Alice 加购→退出→Bob 登录 → Bob 的购物车**不含** Alice 的商品 |
| E2E-AUTH-08 | 推荐链接 | `/login?ref=CODE` 自动切到注册并填入 code |
| E2E-ACC-01 | 个人资料 | 修改姓名保存→刷新仍在 |
| E2E-ACC-02 | 地址簿 | 新增/编辑/删除/设默认；同一时刻只有 1 个默认；必填项校验 |
| E2E-ACC-03 | 收藏页 | 列表、移除、加购 |
| E2E-ACC-04 | `/account/membership` | 重定向到 /account；会员卡显示正确等级 |
| E2E-ACC-05 | 每日奖励/新手任务 | 领取一次后当天不可再领；跨日（`page.clock` 快进）可再领 |

#### 订单 / 物流 / 退货
| ID | 场景 | 预期 |
|---|---|---|
| E2E-ORD-01 | `/orders` | Alice 看到 #1001-#1004，不含 Bob/guest 订单；状态标签正确 |
| E2E-ORD-02 | 订单详情 | 明细、金额货币格式、物流时间线（倒序、无重复） |
| E2E-TRK-01 | `/track` 表单 | 单号+邮箱查到；错误信息有提示 |
| E2E-TRK-02 | `/track/tok_alice_1001` | 无需登录可见物流；页面不显示邮箱/电话/地址；有 `noindex` |
| E2E-TRK-03 | 无效 token | 友好“未找到”提示 |
| E2E-RET-01 | 在 #1001 发起退货（睡裙 qty1，未拆封，size_fit，附 1 图） | 成功→跳到 `/returns/<id>`，显示 RMA 号、资格状态、照片可加载 |
| E2E-RET-02 | 内衣 + changed_mind | 提交后显示不可退（rejected）及卫生原因 |
| E2E-RET-03 | `#1002`（45 天） | 不可退文案 |
| E2E-RET-04 | 取消退货 | 按钮→确认→状态 closed，按钮消失 |
| E2E-RET-05 | 添加退货物流 | 管理员把状态改为 approved 后，表单出现；提交后状态 customer_shipped |
| E2E-RET-06 | `/returns` 列表 | 只显示本人退货单 |

#### 营销 / 其他页面
| ID | 场景 | 预期 |
|---|---|---|
| E2E-MKT-01 | 联系表单 | 成功提示；outbox 2 封 |
| E2E-MKT-02 [D22] | Newsletter 失败 | mock Resend 500 → 前端应提示失败而非成功 |
| E2E-MKT-03 | 礼品卡页 | 金额预设/自定义校验（9、501 拦截）；成功页（取决于 D04 修复方案） |
| E2E-MKT-04 | 推荐页 | 登录后显示自己的码；复制按钮可用 |
| E2E-MKT-05 | Cookie 同意 | 拒绝→不初始化 PostHog（无到 posthog 域名的请求）；同意→有请求 |
| E2E-MKT-06 | 首单免费弹窗 | 关闭后不再出现；点击注册带 `offer=first-free` |
| E2E-MKT-07 | 翻译菜单 `ContextTranslateMenu` | 打开/选择语言/关闭，无控制台错误 |

### 3.6 非功能测试

| ID | 类别 | 内容 | 通过标准 |
|---|---|---|---|
| A11Y-01 | 可访问性 | 首页、集合、PDP、购物车抽屉、登录、账户、退货表单跑 axe | 0 个 serious/critical |
| A11Y-02 | 键盘 | 只用 Tab/Enter/Esc 完成：过年龄门→搜索→加购→打开购物车 | 可完成，焦点可见 |
| PERF-01 | Lighthouse（移动） | 首页 / PDP / 集合页 | Performance ≥ 70，LCP < 2.5s，CLS < 0.1 |
| PERF-02 [D28] | 资源体积 | 首页传输的最大图片 | 单张 < 300KB；logo 用 `next/image` 优化或压缩 |
| PERF-03 [D29] | PDP 服务端耗时 | 记录 Storefront 请求数 | 每次 PDP 请求 ≤ 2 次 Storefront 调用 |
| RESP-01 | 响应式 | 320 / 375 / 768 / 1280 宽度截图 | 无横向滚动（`scrollWidth <= clientWidth`），底部导航不遮挡加购按钮 |
| VIS-01 | 视觉回归 | 关键页面 `toHaveScreenshot`（mock 数据，固定时间） | 差异 < 0.2% |
| CON-01 | 控制台 | 每个 E2E 结束检查 | 无 `console.error`、无未处理 Promise 拒绝、无 hydration 警告 |
| NET-01 | 网络 | 每个 E2E 记录响应 | 无 5xx；无 4xx（预期的除外） |
| SEO-01 [D27] | robots/sitemap | `/robots.txt`、`/sitemap.xml` | 存在；sitemap 含商品与集合 |
| SEO-02 [D27] | noindex | `/account*`、`/orders*`、`/returns*`、`/track/*`、`/login` | 有 `noindex` |
| SEO-03 | 元数据 | PDP 有唯一 title/description/og:image | 通过 |
| COMP-01 [D26] | 隐私声明一致性 | AI 预览调用时比对隐私政策 | 文案需披露数据会发送给 Hugging Face |
| COMP-02 | 包裹/账单隐私 | 所有邮件主题与发件人 | 不出现露骨词汇（品牌“discreet”承诺） |

---

## 4. 执行顺序与 CI

### 4.1 分阶段落地（建议 2 周）

| 阶段 | 内容 | 产出 |
|---|---|---|
| 第 1 天 | 安装工具、本地 Supabase、seed、MSW、instrumentation | `npm run test:e2e` 能跑通 1 个冒烟用例 |
| 第 2-3 天 | **SEC-01~18 + API 契约**（全部 `test.fail()` 标出已知缺陷） | 安全缺陷有了可复现证据 |
| 第 4-5 天 | 单元测试（先把 `evaluateEligibility` 等导出） | 业务规则覆盖 |
| 第 6-9 天 | E2E 旅程（购物车/结账、认证、退货优先） | 主流程回归 |
| 第 10 天 | a11y / 性能 / SEO / 视觉基线 | 非功能基线 |
| 持续 | AI 探索测试（第 5 节）每周 1 轮 + 每个 PR 跑相关章程 | 新缺陷 |

### 4.2 CI（在现有 `.github/workflows/ci.yml` 后追加 job）

```yaml
  e2e:
    needs: web
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npx playwright install --with-deps chromium webkit
      - run: cp .env.test .env.production.local   # 指向本地 Supabase 与 mock
      - run: npm run test:unit
      - run: npm run db:test:reset
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: playwright-report }
```

PR 门禁：`api` + `desktop-chrome` 项目必须全绿（`test.fail()` 标记的已知缺陷不阻塞）；`mobile-safari`、视觉回归、Lighthouse 作为非阻塞报告。

---

## 5. AI 驱动测试方案

目标：让 AI 完成三件事 —— **(A) 按本计划自动写出测试代码**、**(B) 像真人一样探索网站找新缺陷**、**(C) 失败时自动分诊**。

### 5.1 准备

```bash
claude mcp add playwright -- npx @playwright/mcp@latest --viewport-size 1280,800
```

在项目根目录给 AI 一个固定入口（可放进 `CLAUDE.md` 或作为每次的提示词前缀）：

```
你是这个项目的 QA 工程师。测试环境：http://localhost:3100（E2E=1，本地 Supabase，外部服务已 mock）。
测试账号：alice@test.local / bob@test.local，密码 Test1234!。
查看已发送邮件：GET http://localhost:3100/__test/outbox
可用工具：Playwright MCP（浏览器）、Bash（curl / node 脚本调用 supabase-js）。
规则：
1. 绝不连接 .env.local 中的线上 Supabase / Shopify。
2. 每发现一个问题，按 tests/ai/BUG_TEMPLATE.md 写入 tests/ai/reports/<日期>-<章程ID>.md。
3. 每条结论必须有证据：截图路径、请求/响应、控制台日志，或可复现步骤。没有证据的不算缺陷。
4. 不要修改业务代码；只能在 tests/ 下写文件。
```

### 5.2 (A) AI 生成测试代码

对每一节用例表下发任务，例如：

```
阅读 docs/testing/TEST_PLAN.md 第 3.2 节和 tests/fixtures/*。
为 SEC-01 ~ SEC-08 在 tests/api/security.rls.spec.ts 中实现 Playwright 测试。
已知缺陷（标注 [Dxx] 的）用 test.fail() 包裹，并在注释中写缺陷 ID。
写完后运行 npx playwright test tests/api/security.rls.spec.ts，
确认：未标注的用例全部通过；标注 test.fail() 的用例确实失败（证明缺陷存在）。
把运行结果摘要贴回来。
```

验收：AI 必须**实际运行**并贴出结果；对每个 `test.fail()` 解释它失败的原因是缺陷本身，而不是测试写错。

### 5.3 (B) AI 探索测试 —— 测试章程

每个章程是一个独立任务，限时 20-30 分钟，放在 `tests/ai/charters/`。AI 用 Playwright MCP 操作浏览器、用 Bash 调接口。

| 章程 | 使命 | 重点关注（oracle） |
|---|---|---|
| CH-01 新访客首单 | 以全新浏览器从首页走到结账跳转 | 每一步是否有卡住/困惑；价格从卡片→PDP→购物车→结账请求是否一致；浮层是否互相遮挡 |
| CH-02 移动端购物 | iPhone 视口完成浏览、筛选、加购、改数量 | 横向滚动、按钮被底部导航遮挡、点击区域 < 44px、文字截断 |
| CH-03 恶意用户 | 以 Alice 身份，尝试读取/修改 Bob 的任何数据，尝试免费拿到折扣/礼品卡/会员等级 | 任何越权成功 = P0；用浏览器 DevTools 里的 anon key + supabase REST 直接请求 |
| CH-04 表单边界 | 遍历站内所有表单（登录、注册、地址、评论、退货、联系、礼品卡、到货通知、订阅、物流查询） | 空值、超长（10k 字符）、emoji、RTL 文本、HTML/脚本、SQL 片段、前后空格、全角字符；观察是否 500、是否原样回显、错误信息是否泄露内部细节 |
| CH-05 退货政策一致性 | 对照 `/pages/returns` 文案，用 seed 订单尝试各种退货组合 | 页面承诺 vs 系统判定是否一致（如 30 天从何时算、内衣/丝袜规则） |
| CH-06 隐私与私密性 | 这是情趣内衣站，检查所有可能泄露购物隐私的地方 | 页面标题/浏览器历史、邮件主题、追踪页、共享设备残留（购物车、最近浏览、Fit 资料）、第三方请求中的商品名 |
| CH-07 网络异常 | 用 `/__test/mock-mode` 让 Shopify/Resend/HF 超时或 500 | 是否有加载态、是否能重试、是否吞掉错误显示成功 |
| CH-08 多标签/并发 | 两个标签页同时改购物车、同时收藏、同时提交退货 | 数据是否错乱、重复提交 |
| CH-09 内容与文案 | 遍历所有页面 | 残留中文/占位文本（项目有 remove_chinese_text 脚本）、错别字、品牌名不一致（Velour vs Self Love）、死链、图片 404 |
| CH-10 可访问性 | 只用键盘 + 读取无障碍树完成购物 | 无名称的按钮、焦点丢失、对话框无法关闭 |

章程模板（`tests/ai/charters/CH-03.md`）：

```markdown
# CH-03 恶意用户
时长：30 分钟
身份：alice@test.local
使命：在不知道任何其他人密码的前提下，读取或修改其他用户（bob@test.local、guest@test.local）的数据，
      或在不付款的情况下获得任何金钱价值（礼品卡、会员等级、推荐奖励、折扣）。
已知线索：docs/testing/TEST_PLAN.md 第 0 节 D01-D09。先逐条复现，再寻找新的问题。
允许：浏览器、DevTools 中能拿到的 anon key、curl、supabase-js。
禁止：使用 service_role key。
产出：每个成功的攻击写一份缺陷报告；最后给出一段 5 行以内的总结。
```

### 5.4 缺陷报告模板（`tests/ai/BUG_TEMPLATE.md`）

```markdown
## [严重度 P0/P1/P2] 一句话标题
- 章程/用例：CH-03 / SEC-02
- 环境：localhost:3100，commit <sha>，视口 1280x800
- 前置条件：
- 复现步骤：
  1.
  2.
- 实际结果：
- 期望结果：
- 证据：截图路径 / 请求与响应 / 控制台
- 疑似代码位置：src/...:行号
- 建议修复：
- 是否已有自动化用例覆盖：是（ID）/ 否（建议新增用例：...）
```

### 5.5 (C) 失败自动分诊

CI 失败后，把 `test-results/results.json` 和 trace 交给 AI：

```
读取 test-results/results.json 中失败的用例和对应 trace.zip（npx playwright show-trace 可导出）。
对每个失败归类为：①产品缺陷 ②测试脚本问题（选择器/时序）③环境问题（mock/seed）。
②③ 直接修复测试并重跑验证；① 生成缺陷报告，不要改业务代码。
```

### 5.6 AI 测试的防误报规则

- 结论必须可复现：同一步骤重跑 2 次结果一致才记录。
- 只以本文的 oracle 或页面自身的文案承诺为判定标准；“我觉得不好看”归为 P2 建议，不算缺陷。
- 禁止 AI 为了让测试通过而修改断言或删除用例；如认为期望错误，写进报告由人确认。

---

## 6. 退出标准

- P0 缺陷（D01-D09）全部修复，对应 SEC/API 用例去掉 `test.fail()` 后通过。
- `api` + `desktop-chrome` 项目连续 3 次 CI 全绿，flaky 率 < 2%。
- 核心旅程（E2E-CART-*、E2E-AUTH-*、E2E-RET-*）覆盖率 100%。
- axe 0 个 serious/critical；移动端 Lighthouse Performance ≥ 70。
- AI 探索章程 CH-01~CH-10 各至少执行 1 轮，新发现的 P0/P1 已修复或有明确排期。

---

## 附录 A：路由清单（覆盖检查用）

页面：`/`、`/sale`、`/membership`、`/collections/[handle]`、`/products/[handle]`、`/login`、`/account`、`/account/{addresses,membership,orders,profile,wishlist}`、`/orders`、`/orders/[id]`、`/returns`、`/returns/[id]`、`/track`、`/track/[token]`、`/pages/{about,contact,faq,gift-card,privacy,referral,returns,shipping,size-guide,terms}`、not-found。

API：`/api/ai-preview`、`/api/contact`、`/api/cron/abandoned-cart`、`/api/email`、`/api/gift-card`（GET/POST）、`/api/logistics/track`、`/api/membership`（GET/POST）、`/api/newsletter`、`/api/referral`（GET/POST）、`/api/restock-notify`、`/api/returns`、`/api/returns/[id]/cancel`、`/api/returns/[id]/tracking`、`/api/reviews`（GET/POST）、`/api/shopify/cart`、`/api/shopify/oauth/start`、`/api/shopify/oauth/callback`、`/api/shopify/webhook`、`/auth/callback`。

## 附录 B：为便于测试建议的小改动

1. 从 `src/lib/returns.ts` 导出 `evaluateEligibility`，从 `src/lib/products.ts` 导出 `mapShopifyProduct`、`collectionFilter`，便于单元测试。
2. 图标按钮补 `aria-label`（购物车加减/删除、收藏心形、关闭按钮），E2E 和 AI 都依赖它定位。
3. 增加 `src/instrumentation.ts` + `__test` 路由（仅 `E2E=1` 生效，生产构建中必须返回 404 —— 本身也要有一条测试验证）。
4. 限流改为可注入的存储（测试中可重置），否则限流用例之间会互相污染。
