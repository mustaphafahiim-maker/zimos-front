# UX redesign — progress

Branch: `ux-redesign` (from `claude/gracious-cori-p3g4hr` @ `1fc9906`).
Backend (read only): `zimos-backen` `claude/gracious-cori-p3g4hr`.
Resume rule: read this file, then `07-plan.md`, then continue at the first
unchecked step. Handoff items from the backend live in
`docs/progress/frontend-handoff.md` of the backend repo; the ones done here
are listed under *Handoff items done*.

## Phases
- [x] 1 Understanding — `01-understanding.md`
- [x] 2 Feature inventory — `02-features.md`
- [x] 3 Priorities — `03-priorities.md`
- [x] 4 Audit — `04-audit.md` (68 issues, against base + S1)
- [x] 5 Proposal — `05-proposal.md`
- [x] 6 Design system — `06-design-system.md`, tokens `packages/ui/src/tokens.css`
- [x] 7 Plan — `07-plan.md`
- [ ] 8 Implementation (steps below)

## Implementation steps
- [x] S1 Family tokens + calm shell: neutral palette, Readex Pro, Arabic
      first, sidebar ordered by daily jobs, one word for orders (أوردر),
      phone bottom tab bar with the waiting-call badge. (dc297fb)
- [x] S2 Home answers first: to-do tile, honest profit, product behind a
      loss, rates as "N of 10", lost orders, details folded; fixed the
      hidden bottom menu block and the /abandoned 404. (6b57cf7)
- [x] S3 Words everywhere: ~90 error messages rewritten in Egyptian Arabic;
      getErrorMessage (28 files) and sign-in/up pages go through the same
      translations; unknown English server text never shows in the Arabic UI;
      session-expired notice + return to the page; status words in Arabic
      (StatusBadge fallback, stages: one name «مستني تأكيد»); ConfirmDialog
      defaults; friendly error / no-permission cards; back arrow mirrors.
- [x] S4 Orders list: search then stage chips then one toolbar row (filters,
      date, sort); secondary tools fold behind «أدوات تانية» on phones; phone
      cards with select, call and WhatsApp (ContactActions), name first;
      select-all on phones; dates start at the device's midnight, not UTC;
      a guiding empty state for a store with no orders yet.
- [x] S5 Order page: hero card (customer, phone, one-tap call/WhatsApp,
      address, total, payment) and a next-step card per stage that scrolls to
      its section; actions swipe in one row on phones; work sections on the
      wide column, notes/tags/background beside them; tel: link in the
      summary; Arabic address formatting; Fulfillment no longer sees
      Analytics links it cannot open.
- [x] S6 Confirmation queue: header answers «باقي ٥ مكالمات · ٤ منهم معادهم
      جه»; «استلم واتصل» claims then opens the dialer on phones; warning when
      ≤3 min are left on a claim; outcome buttons with icon and meaning
      colour; full-width actions on phones; guiding empty state; filters side
      by side; Egyptian copy. (Callback time for «أجّل» waits on the backend.)
- [x] S7 Products list: phone cards (photo, name, price, stock, status,
      actions, select) instead of an 820px table; table/grid from md; a
      guiding first-product empty state; calm table; Egyptian copy.
- [x] S8 Product form: description optional (API accepts it; matches the
      setup guide's promise), first error scrolled into view and focused,
      leave-page warning while basics are unsaved, advanced sections folded
      under «إعدادات تانية» (offers stay visible).
- [x] S9 Onboarding: setup guide leads with «الخطوة الجاية», other steps
      below, done steps in one line; domain step → /store-settings/domains;
      test-order step opens the store; local percent digits; sign-in pages
      calm (no glass/blobs) with a language switch; login email LTR; sign
      out on the plan step. (Covers S15 auth restyle too.)
- [x] S10 Dialogs and toasts: Modal (91 call sites, same props) on Base UI
      Dialog — focus trap + restore, translated close button, backdrop tap no
      longer discards forms, bottom sheet on phones; toasts with icon + close,
      errors stay 10 s; install prompt sits above the phone tab bar.
- [x] S11 Profit + settlements: profit opens with «فضلك X — يعني Y% من كل
      جنيه بعته» and the biggest cost as a share of sales (hidden when no
      costs are set, so it never claims a fake profit); plain «أقصى تكلفة
      إعلان للأوردر»; settlements header «شركات الشحن لسه عليها X لـ N أوردر»;
      title matches the menu. PageHeader actions wrap: 38 routes checked at
      390 px, none wider than the screen.
- [x] S12 Command bar: Arabic-insensitive matching (أ/إ/آ, ة/ه, ى/ي,
      diacritics), a real error state instead of «no results», a close button
      for touch, «أوردر جديد» really opens a new order, confirm-orders action,
      no duplicate rows, Egyptian copy.
- [x] S13 Storefront checkout (phone): sticky total + order bar, shopper-language errors — see R2-3.
- [x] S14 Settings: 15 stacked sections → six tabs (المتجر، الرسايل، الفريق،
      الباقة والفواتير، حسابي، المطورين) kept in ?tab=; old #whatsapp /
      #notifications links open the right tab; the billing banner links to
      the billing tab.
- [x] S15 Auth pages — done inside S9 (calm card, language switch, LTR email).
- [x] S16 Platform admin adopts the family tokens (data-product="store",
      Readex Pro); the console now matches the dashboard's palette and radii.
- [x] R2-1 DataTable phone cards (18 screens): each row a card on phones —
      title, tick box beside it, label/value lines; columns can opt out
      (phoneHidden); dense numeric reports keep the table (phoneCards=false).

## Handoff items done (from backend `frontend-handoff.md`)
- [x] Request: order search by last phone digits — placeholder + hint
- [x] Request: Fulfillment can book couriers — no UI gate existed; works
- [x] Request: errors in the reader's language — dashboard sends Accept-Language
- [x] Request: postponed/no-answer callback time — CallbackPicker in the queue
- [x] Request: time-zone aware order dates — list sends `tz` with the dates
- [x] 163 + 164 (dashboard): Shipping → «المناطق» tab — regions/cities/areas
      browser, add/rename/hide/delete, import sheet (+sample CSV with the
      shipping column), start from the platform list, inline prices saved
      together, inherited-price hints; order page names the city/area rule.
      Storefront checkout pickers + quote: pending (after 165 lands).
- [x] 162 smart collections (type: manual / by tags / all products, tag
      chips, refresh, «اعمل مجموعة كل المنتجات» empty state, 409 toast)
- [x] 166 funnel bulk (select, publish/pause/resume/duplicate/delete, ≤50,
      results dialog for failures)
- [x] 160 store texts: Website → «نصوص المتجر» (/website/texts) — per-language
      overrides, default shown per row, placeholders, search, changed-only,
      one PUT; storefront merges them over its dictionary (server + client).
- [x] 161 store scripts: Store settings → Custom code → «السكريبتات» — table /
      phone cards, add/edit dialog (position, pages, code ≤50k), reorder,
      toggle, delete; storefront injects by page type with the existing guards.
- [x] 165 checkout photo field + optional billing address (form settings,
      storefront checkout on cart/product/funnel, order page thumbnails + card)
- [x] 167 «سجّل الطلبات كـ» Purchase/Lead per store and funnel (+ storefront events)
- [x] 168 Pinterest server events (ad account id, token mask, test events)
- [x] 163/164 storefront place pickers + quote, S13 checkout phone layout (R2-3)
- [x] 172 home filters: product and store (when >1 website) pickers on the
      home, remembered per store; profit tiles step aside while filtered (P&L
      has no product split); «الزيارات للمتجر كله» note; stale ids reset.
- [x] 169 Google Ads purchase + lead conversion labels (dialog + storefront send_to)
- [x] 170 GTM ready-made container download + dataLayer events table (+ storefront pushes)
- [x] 178 webhook custom headers (masked, change/keep) + grouped new topics + edit dialog
- [x] 179 «مساعدين الذكاء الاصطناعي (MCP)» panel: server URL, tools, AI key shown once, setups
- [x] 176 buy a domain (search, buy dialog with the API's price, price-change re-confirm, bought domains table with renew/auto-renew)
- [x] 177 «حوّل الزوار للدومين الأساسي» switch per non-primary domain
- [x] 173 sending domain for customer emails (records with copy, verify, change, remove)
- [x] 174 block email designer (simple text / designer, up-down blocks, variables, preview phone/desktop, test send)
- [x] 175 emails per funnel (funnel settings → Emails) and per website (when >1)
- [x] 171 Live view on a world map: Analytics → مباشر الآن → «المشاهدة
      المباشرة» tab (5/10/30/60 min, funnel filter, full screen); totals,
      top places and countries tables, world map + Egypt/Saudi inset with
      shape + colour per kind, 15 s polling while visible; all states.
      Map geometry generated from Natural Earth (public domain), no new
      dependency. Checked at 390/1366 against the real API.

## Round 2 (plan: `09-plan-round2.md`, from the re-audit `08-reaudit.md`)
- [x] R2-1 Phone cards in DataTable (before the re-audit).
- [x] R2-2 Home tells the truth: queue/pipeline/recent orders keep error,
      no-permission (403 → tile hidden) and zero apart; error tile with
      «جرّب تاني» stays on top; partial failure shows the rows that loaded +
      «جزء من القايمة مجاش»; a store with 0 orders gets «لسه مفيش أوردرات»
      (recent-orders tile hidden then); only due calls count (home + tab
      badge), «ومكالمتين متأجلين لبعدين» under the list; to-do rows outlined
      so white text sits on the full brand fill (N-09). Checked at 390/1366
      with the API forced to 500, 403 and an empty store.
- [x] R2-3 Storefront checkout (S13 + handoff 163/164 storefront side):
      region → city → area pickers from the store's own places, each pick
      re-quotes shipping and the order sends province/city/area/placeId
      (also on the product quick-order form and funnel step); phone bar with
      the estimated total + «اطلب دلوقتي» that hides while the page button
      or the keyboard is up; known refusals in ar/en/fr, never untranslated
      English; refused coupon shown beside the code; optional name not
      marked required (U-62). Checked at 390 (ar, fr) and 1366; 3 scratch
      COD orders placed with 40.00 / 45.50 place prices. Funnel step
      typechecked only (only funnel is an unpublished draft). Two backend
      requests added (quote `configured` flag; cart estimate name match).
- [x] R2-4 First product (N-04): a new product is on sale when saved, with
      a visible «اعرضه في المتجر على طول» tick that turns it into a draft;
      the form starts with name → price → quantity → photos, the rest folds
      under «تفاصيل تانية (اختياري)» and opens itself when one of its fields
      has an error; a 0 quantity warns it shows as sold out; Markdown syntax
      help dropped (toolbar does it); form copy in Egyptian Arabic. Edit
      mode keeps its layout (status select). Checked at 390/1366.
- [x] R2-5 Queue diet (N-03, N-23): a card is the customer's name, the
      phone with WhatsApp, then order number · items · total and the address
      in small type; the tick box sits beside the name (aria-label only);
      assignment is one line with «وزّع / غيّر» opening the picker for
      managers, hidden for agents when nobody is assigned; «سجّل واللي
      بعده» brings the next card into view with its button focused; the
      button says «استلم» where no dialer opens; filters labelled on phones
      («مين شغال عليها»). Card gap doubling fixed once in index.css for all
      36 `<Card className="space-y-…">` sites. 517 → 319 px per card at 390.
- [x] R2-6 Numbers and plurals (N-10, N-13, part of N-14): `fmt` writes
      every number with the viewer's digits (grouped from 5 digits, so years
      and codes stay whole); `countOf(unit, n)` in lib/plural.ts for
      minutes, hours, days, orders, items, calls, pieces («دقيقتين»، «٣
      أوردرات»، «١١ أوردر»); used in the queue and order confirmation panel
      (copy now Egyptian), order session details, bulk bar, settlements;
      notification totals in the app's money format; the setup guide shows
      one count; the merchant's own courier reads «المندوب بتاعك» everywhere
      `providerName` is used (no more «manual-courier»). Checked ar + en.
- [x] R2-7 Touch sizes and dialogs (N-08, N-24, U-36, U-37): on touch
      screens every button, field, select and filter tab is ≥ 44 px, in
      pages and in dialogs, and fields use 16 px text (no iOS zoom) — one
      `@media (pointer: coarse)` block in index.css (it also beats the old
      desktop rule that capped role=group buttons at 36 px). Modal: a tap on
      the backdrop closes a clean dialog; once something was typed, backdrop
      / Esc / × ask «تسيب التعديلات؟» (كمّل تعديل / سيبها); a caller's own
      Cancel or a save isn't asked. Swipe-down not added (no gesture
      library). Checked with touch emulation at 390.
- [x] R2-8 (part) One name per thing (N-02): Settings → «هوية المتجر» (name,
      logo, tagline) and Store settings → «بيانات التواصل» / «بيانات التواصل
      في المتجر» (what shoppers see) no longer share the title «بيانات
      المتجر»; copy of both in Egyptian Arabic. Moving the identity form
      into Store settings is left for later (the shopper-accounts branch is
      adding a Store settings tab now).
- [x] R2-9 (part) Phone shell (N-06 a–f): «المزيد» lights up on pages
      without a tab; the menu slides in from the «المزيد» side (end edge)
      and leaves out the bar's own pages; the header hamburger is gone (one
      way in); tab labels 12 px; tabs follow the role (editor: home +
      products; fulfillment: no confirm; confirmation agent / accountant: no
      products; custom roles see all); badge digits localized. Checked at 390
      for owner and three routed roles. Section tabs as a scrolling tablist
      (N-17) still to do.
- [x] R2-9 rest (N-17): new `SectionTabs` for page sections (Settings,
      Store settings, Shipping): role=tablist, one tab in the Tab order,
      ← → Home End (direction-aware), one sideways-scrolling row on phones
      with the current tab centred, 44 px. FilterTabs stays for list
      filters. Store settings went from 4 rows of tabs to one at 390.
- [x] R2-10 Words pass 2 (N-14, N-21): `placeName` shows «القاهرة» not
      «القاهرة (Cairo)» in addresses, order columns, shipments, customers and
      contacts; the orders governorate filter is a picker of governorates
      (the API matches the saved value exactly, so "Cairo" never matched);
      store-text developer keys hidden (hover shows them); ~20 activity
      areas and ~60 actions named in Arabic; «الفانل/الفانلز» → «مسار البيع
      / مسارات البيع» (87 places); product status «شغّال» everywhere; «…»
      quotes in Arabic strings; word list added to 06 §6.
- [x] R2-11 Contrast and phone cards (N-09, N-07): `text-white` on token
      fills → `text-primary-foreground` / `text-paper-raised` (bell badge,
      image "main" chip, funnel step dot, shoppable hotspots, editor layers
      and tabs) so dark mode keeps ≥ 4.5:1; to-do tile rows outlined (R2-2).
      DataTable phone cards: the title's link stretches over the whole card
      (tap anywhere opens it; links/buttons/tick boxes inside still work),
      the tick box gets a 44 px area, blank values ("—", empty) and a
      column's `phoneSkip(row)` lines are left out (contacts with no orders
      skip orders/paid/delivery), header-less cells sit outside the <dl>.
- [x] R2-12 (part 1): N-11 the no-costs product tile says «أكتر منتج اتباع»
      → «شوف المنتجات»; N-12 the no-costs profit line names what it holds
      (shipping, returns, fees, ads, orders on the way); N-15 an unpaid COD
      order shows «هيتدفع عند الاستلام» (neutral) and no «استرداد» before
      anything is collected (display only); N-22 ⌘K input without the
      browser's second ×, key hints hidden on touch; N-25 order stage chips
      in COD order with empty stages dimmed and local digits, products
      «اختار الكل» label on phones.
- [x] N-19 Store texts: each store page's texts fold into one line with
      «اتغيّر ٣ من ١٢» (opened by search, a section pick or "changed only");
      closing the tab with unsaved texts asks first. 32,677 → 1,335 px at 390.
- [x] N-16 Order actions: the step that moves the order on (WhatsApp
      confirm / fulfil) stays in view, the everyday tools (edit address,
      waybill, edit items, copy link, invoice, test, archive, resend) fold
      under «أكتر», and «إلغاء الأوردر» sits last, at the far end.
- [x] N-20 Home filter: the to-do tile (and the setup guide) come first
      for the whole store; the product / store filter sits under them, above
      the numbers it changes, with the heading «أرقامك» / «أرقام Demo
      T-Shirt» and a note that latest orders stay store-wide.
- [x] N-18 Lost orders on phones: the three stat cards become one line, the
      status tabs one scrolling row, the five filters fold behind «الفلاتر
      (n)» with date shortcuts (النهارده / ٧ أيام / ٣٠ يوم); title «الأوردرات
      المفقودة» like the menu. Round 2 (R2-1 … R2-12) is done; see 00-summary.

## Handoff items 180–187 (backend 2026-10-06, second batch)
- [x] 184 Address suggestions at checkout: «دوّر على عنوانك» combobox
      (2 chars, 250 ms, keyboard, one session per visit) above the address
      fields on checkout, product quick order and funnel step; a pick fills
      region → city → area and re-quotes shipping, then the street or focus;
      dashboard Shipping → المناطق card «اقتراحات العنوان في صفحة الدفع»
      (off / places list / Google with key). Store left on the places list.
- [x] 186 Shopper returns: dashboard /returns settings card (switch, days,
      photo-required reasons) folding to one line; «من العميل» badge and
      photo thumbnails (large view) on the returns list and order page;
      storefront tracking page «ارجع منتجات» with the deadline, past
      requests, form (quantities, reason, details, up to 4 photos), shopper
      copy in ar/en/fr. Reusable <ShopperReturns> for the account order
      page. Signed-in variant blocked by CORS (backend request added).
- [x] Backend answers to our 4 requests: bought-but-not-connected domain
      notice, «جهزناه لك» for a managed www, renew dialog with a price
      quote for 1–10 years and price-change re-confirm, funnel/website
      plain-text email overrides that stay plain (row chip «نص بسيط»).
- [x] 181 Your other store (Shopify / WooCommerce): /apps/dropshipping
      «متجرك التاني» group with credential forms from credentialFields and
      help lines; import by «رقم المنتج في متجرك»; SKU warning on the
      product page, variant dialog and bulk editor for linked products;
      order Supplier card «اتبعت لمتجرك كأوردر رقم …». Checked with a local
      mock Shopify; one backend request (app store entries).
- [x] 182 Email marketing: /apps/email-marketing — Mailchimp, Klaviyo and the
      test list; connect / list / tags / leads-buyers / save / «زامن
      دلوقتي» with progress / last error / disconnect; install from the
      page. Checked end to end with the sandbox provider.
- [x] 183 Express checkout: «دفع سريع» card at the top of checkout (Apple
      Pay where the browser supports it, Google Pay, yellow PayPal) that
      validates and submits the page's own form, then «أو ادفع بطريقة
      تانية»; PayPal return handled; dashboard Payments connects Stripe
      (express switch, webhook note) and PayPal (currency notice), wallet
      badges, real method names; «باي بال» in labels/filters/rules. Checked
      with the sandbox gateway on a second local backend (two paid orders).
- [x] 180 Import from a product link: source badges (Shopify, AliExpress,
      Etsy, CJ, YouCan) lit from the pasted link; after import «اتضاف كمسودة —
      راجع السعر والمخزون» with the page's price/currency, «راجع المنتج», and
      «{n} تقييم مستني موافقتك» → Reviews filtered to pending + imported;
      friendly refusals. Live outside pages unreachable from this machine
      (success path checked with a forwarded JSON import). Two backend
      requests (report fields, own codes).
- [x] 187 Import contacts: /customers/import — template download, file,
      update/skip, tags, consent note, «راجع الملف» summary with plurals,
      matched columns, error table (cards on phones), then «استورد»; links
      from the contacts header and empty state. Checked with real CSVs.
- [x] 185 Shopper accounts: dashboard Store settings → «حسابات العملاء»
      (switch + SMS / email code); storefront /account (orders with paging,
      order page with the tracking timeline and «اطلب تاني», addresses with
      the place pickers, profile, sign out / everywhere), sign in by code
      with countdown and every refusal in ar/en/fr; header link (in the
      menu sheet on phones); checkout prefill + saved-address picker + «احفظ
      العنوان ده». The account order page also carries «ارجع منتجات» (186).
      Signed-in calls need the backend CORS fix (request filed); verified
      with a preflight shim, one real COD order placed. Store left off.

## Handoff items 188–199 (backend 2026-10-06, third batch)
- [x] 193 Zapier and Make: app cards open /apps/zapier and /apps/make — three
      steps, «اعمل مفتاح API» with the right scopes (shown once, copy), the
      webhooks the tool subscribed (N of 25), triggers and the envelope;
      Zapier / Make badges on their webhook endpoints.
- [x] 191 Display rules: every builder / funnel-step element has a «الظهور»
      tab (dates on the store's clock, devices, countries in/out, UTM
      source / medium / campaign) with a summary chip and outline marks; the
      storefront applies device (CSS), country (visitor context) and UTM
      rules without a gap or flash.
- [x] 188 Wishlist: heart on product cards and the product page (guests
      get one sign-in notice), account tab «المفضلة» with add to cart,
      guest hearts merged on sign-in; dashboard «الأكتر في المفضلة» card.
- [x] 194 Back-in-stock: «بلغني لما يرجع» (phone or email) replaces the cart
      buttons on a sold-out variant (sold-out options can now be picked,
      still struck through); dashboard «مستنيين يرجع» card and «{n} مستني»
      badges on variants. One backend request (wishlist availability).
- [x] 189 Gift cards: dashboard /gift-cards (list with phone cards, state
      tabs, search; issue dialog showing the code once; detail with history,
      adjust, resend, disable; products sold as gift cards), order page names
      «كارت هدية •••• XHLV»; storefront balance page, checkout field (with
      the phone bar showing what's left to pay on delivery) and thank-you
      note. One real COD order paid partly by card. Refund dialog says the
      money goes back to the card — verified for gift-card payment refunds
      (giftCardProvider.js); that a manual refund picks the card is Inferred.
- [x] 195 Pre-orders: product card / page «اطلبه مسبقًا» with the ship date
      and limit, «طلب مسبق» badges in the products list, ship date on cart,
      checkout, thank-you and order page.
- [x] 198 Purchase limits: «حدود الشراء» card in the product's «إعدادات
      تانية» fold (per-customer ≥ minimum checked); storefront limits line,
      stepper bounded, refusals that name the product in cart and checkout.
- [x] 199 Delivery dates: Shipping → «مواعيد التوصيل» (working days, cutoff
      hour, no-delivery weekdays, per governorate / place overrides); «هيوصلك
      من … لـ …» on product, cart, checkout, thank-you and tracking; «التوصيل
      المتوقع» on the dashboard order page. Shipping line «بيتحسب بعد ما
      تختار منطقتك» for places-only stores (the old workaround removed).
- [x] 190 Blog: dashboard /blog (drafts / published / scheduled, search,
      category filter, phone cards), block editor (8 block types, cover and
      images from the media library, tags, author, SEO incl. noindex,
      schedule), /blog/categories, menu «المدونة»; storefront /blog index,
      category and tag pages, post page with OpenGraph + JSON-LD, «من
      مدونتنا» on the built-in home. No page-builder "latest posts" section
      yet; local uploads give http URLs the API refuses (https only).
- [x] 196 Cookie consent: Store settings → «الخصوصية» (off / notice / ask
      first, countries to ask with a one-tap Europe add, policy link,
      wording per language, preview); storefront banner that holds Meta,
      Clarity and GTM until accept (only for asked countries), consent sent
      with events and the order, «إعدادات الكوكيز» in both footers, events
      fired before pixels mount are replayed after accept. Open: the
      product page's phone buy bar now gets room too (the banner lifts above
      it while the bar shows) — checked: banner ends at 772 px, bar starts
      at 775 px on a 390 phone.
- [x] 192 Template marketplace: /funnels/marketplace «القوالب» (search, kind,
      order, language, preview per page at phone / computer width, «استخدم
      القالب ده») and «قوالبك» (review status, reviewer's note, edit,
      resubmit, withdraw); «سوق القوالب» tab in the new-funnel wizard;
      «شارك في سوق القوالب» from the funnels list and editor. Platform
      console /marketplace review queue (approve, reject with a note,
      unlist), templates.view / templates.manage.
- [x] 180 follow-up: the link import dialog opens the new draft by the
      report's productIds, shows «السعر بعملة الصفحة: USD — راجعه قبل
      النشر» and the imported review count; LINK_* refusal codes mapped (the
      text matching stays only for older answers). 200 (email campaigns) was
      withdrawn by the backend; nothing had been built for it.
- [x] 197 Store access: Store settings → «دخول المتجر» (open / password /
      coming soon with date and sign-ups, lock funnels too, age check 13–25,
      «العميل هيشوف إيه» with preview links, confirm before locking,
      sign-ups list + CSV); storefront password page (30-day unlock
      cookie), coming-soon page with countdown and sign-up, age question
      over the store; track / orders / pay / preview routes stay open.
      X-Store-Gate CORS is done on the backend; one nice-to-have request
      (lockFunnels in the public gate view).

## Handoff items 201–222 (backend 2026-10-06, fourth batch)
Three agents at a time (16 GB machine), brief in the scratchpad's BATCH4.md.
200 (email campaigns) was withdrawn by the backend.
- [x] 220 + 287 Shopper self-service: Settings → «الأوردرات» (cancel /
      change address + window), tracking page and account order page buttons
      with «متاح لحد …». On the tracking page the address form opens empty
      (the tracking answer has no address; order id decoded from the token).
- [x] 226 Pick list: /orders/pick-list from the bulk bar and the ready-to-ship
      tab (per location, tick boxes, print PDF, scan-to-pack per order).
- [x] 244 + 294 Packing slips: bulk dialog (A5/A4, note remembered) and
      «اطبع ورقة التجهيز» on the order page; skipped cancelled orders reported.
- [x] 249 Scan to pack: /orders/:id/pack (focused input, wrong item / over
      signals with text + beep, undo, confirm anyway with a reason), «اتغلّف»
      chip on the order and the list. No camera scanning.
      (220, 226, 244, 249: local, 2026-10-07, not committed)
- [x] 221 Delivery date and time slots: Shipping → «مواعيد يختار منها
      العميل» (weekly grid, closed days, note), day + slot chips at checkout
      (full ones «محجوز»), «ميعاد التوصيل» with change / force on the order
      page, /orders/delivery-schedule, the sentence on the thank-you page.
      The tracking page shows the time only on the device that ordered (the
      tracking answer has no slot). Funnel form: mounted, never opened.
- [x] 216 Holiday mode: Settings → «الأوردرات» → holiday mode; storefront
      banner, «الطلبات هتتشحن من …» notes, paused buttons and the 423 refusal
      at checkout, `holiday` chip on the orders list.
- [x] 225 Click and collect: Shipping → «الاستلام من الفرع», the delivery /
      pick-up choice at checkout (no address form, shipping «مجانًا»), pickup
      code on the thank-you and tracking pages, /orders/pickups (ready, hand
      over with the code), pickup block on the order page.
      (216, 221, 225: local, 2026-10-07, not committed; all three left OFF
      in the demo store)
- [x] 203 Loyalty points: /loyalty (programme settings + summary), points
      card on the customer page (history, add / take), storefront «هتكسب N
      نقطة» on the product, «استخدم نقطك» at checkout, account «نقطي».
- [x] 204 Store credit: /store-credit (balances, spending switch), credit card
      on the customer page, refund dialog «الترجيع يروح فين؟» (money / store
      credit / back to the card, points or credit that paid), checkout «استخدم
      رصيدك», account «رصيدي».
- [x] 201 Gift cards with online payments: card field with every method but
      bank transfer, held lines on the pay page, ledger labels. Online states
      seen with stubbed answers only (online payments are off on the local API).
      (201, 203, 204: local, 2026-10-07, not committed)
- [x] 265–267 Partner apps: /settings/developers (apps, keys, installs),
      /oauth/authorize approval page, «افتح» frame page for installed apps,
      webhook «من تطبيق» chip and removed-app note; platform console «Partner
      apps» (typechecked, not opened in a browser).
- [x] 263 Dropship supplier shipping rates / minimum order switches, and the
      storefront's below-minimum notice in cart and checkout.
- [x] 252 Transfer the store to another owner (Settings → Team; refused
      attempt checked for real, a completed transfer only with stubs).
- [x] 262 + 269 Merchant sign-in with a WhatsApp code (third option on the
      sign-in page; request and wrong code for real, success path stubbed).
      (252, 262–269: local, 2026-10-07, not committed)
- [x] 208 Free gift: /offers/free-gifts (card in the Offers hub); cart drawer,
      cart page and checkout show the earned gift as a free line and an
      "add X more" nudge with a progress bar.
- [x] 214 Gift wrap and message: Store settings → «خيارات الهدايا»; checkout
      «ده هدية؟» block adds the wrap to the summary; order page «الأوردر ده
      هدية» card; waybill prints it (backend PDF).
- [x] 215 Mix-and-match box: «اخلط واختار» switch in the bundle editor, badge
      and «انسخ لينك البوكس» on bundles; storefront /box/:id builder from
      «كوّن البوكس بتاعك» on the product page, priced by the server.
      (208/214/215 were built on `ux-redesign` (c83a18f, 183a59f, 99c7bb5) and
      brought into this working tree on 2026-10-07 as a patch, not a merge.)
- [x] 205 Wholesale price lists: /offers/price-lists (card in the Offers hub;
      percent or fixed prices with quantity tiers), hint on the customer page;
      storefront «سعرك: … بدل …» + tier table, cart and checkout priced with
      the shopper's token (the product page's own order form too).
- [x] 218 VIP tiers: /loyalty/vip (tab of «الولاء والمكافآت»), tier card on
      the customer page; storefront /account/vip, «خصم VIP» line at checkout
      (the cart and the shipping quote do not know the tier, so the estimated
      total does not move; the order comes back at the tier price).
- [x] 222 Refer a friend: /loyalty/referrals (settings + invites table),
      invites card on the customer page; storefront /account/invite, landing
      banner on ?ref=, checkout line with «كمّل الطلب من غير الدعوة».
      (205, 218, 222: local, 2026-10-07, not committed)
- [x] 219 + 275 Quotes: Orders → «عروض الأسعار» (/quotes inbox + editor),
      storefront «اطلب عرض سعر» on the product page and the cart, /quotes/:id
      (prices, validity, accept with an address, decline; accept once).
      (local, 2026-10-07, not committed)
- [x] 206 Stock locations: Products → «المخزون» (/inventory, tabs المخازن ·
      نقل مخزون), location page (stock, receive / write off), Settings → store
      tab «المخازن», stock per location on the product page, «بيتشحن من» on the
      order page, upgrade notice for FEATURE_NOT_IN_PLAN. Two-location flows
      (transfer, make default, ships-from) checked against stubs only: the demo
      store's plan has no multi_warehouse. (local, 2026-10-07, not committed)
- [x] 207 Suppliers, purchase orders (draft → ordered → received in parts,
      update cost, cancel) and stock counts (save as you go, apply, cancel)
      as tabs of /inventory; exercised end to end against the real API.
      (local, 2026-10-07, not committed)
- [x] 210 Size charts: /size-charts (list, grid editor, attach to products /
      collections), chart note on the product page; storefront «دليل المقاسات»
      sheet with a cm/inch switch (the first column is never converted).
- [x] 212 Product Q&A: /questions inbox (waiting / published / hidden, answer,
      publish, hide, delete), questions section on the product page; storefront
      list + «اسأل سؤال» form.
- [x] 211 Store search: /analytics/search (totals, top searches, no-result
      searches with «أضف مرادف», top clicked) and /search-synonyms; storefront
      reports result clicks and shows «نتايج عن …».
- [x] 202 Summary reports: Settings → My account, under «My notifications»
      (daily / weekly, recipients, sandboxed preview, send to me now).
- [x] 213 Licence codes alert: «نبّهني لما يفضل» + waiting-codes banner in the
      product's Codes section (/digital?product=<id>); the banner reads the
      `stock.low` notification because the codes endpoint has no waitingCodes.
      (210–213 and 202: local, 2026-10-07, not committed)
- [ ] 209 customer notes — queued (crm group)
- [ ] 216 holiday mode, 217 Google sign-in — queued (checkout group)

## Handoff items 223–312 (local desktop chat, 2026-10-07, working tree only, not committed)
Built by parallel agents in this checkout; plan and per-group notes in the
session scratchpad's WAVES.md. Items not listed here are still in progress.
- [x] 238, 242, 245, 246, 247, 239, 240, 256, 293 Store reports: Analytics →
      «تقارير تانية» (/analytics/reports/<slug>: tax, order-times,
      sales-by-collection, sales-by-option, returns, inventory-value,
      slow-stock, cart-offers), each with a date range in the store's time
      zone and «تنزيل CSV». 240 has no «اعمل تخفيض مجدول» link yet (waits for
      227); 256 has no link from Cart offers yet (waits for 253).
- [x] 241 Discount results: four columns + range + CSV on the Discounts list,
      full numbers at the top of the discount's edit dialog.
- [x] 251 Six more pixel platforms (X, Taboola, Outbrain, Kwai, Reddit,
      Microsoft): «إضافة بيكسل» is now a tile grid of all 13 platforms
      (lettermarks, no brand art), per-platform ID hints, X event-IDs table;
      the storefront loads each tag only after consent and maps our events.
- [x] 255 Server-side conversions for Reddit / X / Microsoft (keys, test mode).
- [x] 257 «تجريبي» chip when server events go to a sandbox.
- [x] 254 Ad spend and attribution for the new platforms; link builder
      shortcuts; the four new click ids kept on the order.
- [x] 261 Ad accounts (/ads/accounts): connect, pick, sync; pause / resume /
      budget on a campaign with a confirm (sandbox adapter only).
- [x] 264 Product feed per channel: channel cards on the existing «ملف
      المنتجات» page (own collection, sold-out rule, Google checklist hold).
- [x] 209 Customer notes and follow-ups: customer page tab «ملاحظات
      ومتابعات» (?tab=notes), Customers → «متابعاتي» (?tab=followups), the
      `customer.followup` notification worded.
- [x] 250 Customer timeline: customer page tab «كل اللي حصل» (?tab=timeline)
      with kind chips and load more.
- [x] 237 RFM groups: Customers → «تقسيم العملاء» (?tab=groups), «المجموعة»
      filter on the list, RFM card on the customer page.
- [x] 248 Merge duplicates: «عملاء ممكن يكونوا نفس الشخص» card, side-by-side
      merge with a destructive confirm and the result.
- [x] 235 Privacy requests: Customers → «طلبات الخصوصية» (?tab=privacy),
      export / erase on the customer page, storefront /account/privacy.
- [x] 232 URL redirects: Store settings → «تحويل الروابط» (table, add / edit,
      CSV import with numbered problems); the storefront looks a redirect up
      before every 404 (page, product, collection, blog post).
- [x] 233 Store locator: Store settings → «فروعنا»; storefront /branches +
      footer link. «أقرب فرع ليا» is built and hides itself while the
      storefront's Permissions-Policy forbids geolocation.
- [x] 236 Post-purchase survey: Store settings → «استبيان بعد الشراء», the
      questions on the thank-you page (also a funnel's), answers on the order
      page, /analytics/survey. The answer is saved through a same-origin PUT
      relay (app/store/[workspaceId]/api-put): the API's CORS has no PUT.
- [x] 217 + 278 + 279 Sign in with Google for shoppers: setting card in
      customer accounts, Google's button on the sign-in sheet with the nonce,
      verified-email block on the profile. A real Google sign-in cannot
      complete on the local API (no Google client): stubbed.
- [~] 312 Funnels on a locked store: the funnel's calls carry ?funnelId=
      (the X-Funnel-Id header is blocked by CORS). A shopper whose step is
      open can order; a new visitor still gets 423 on the step's product —
      needs the backend.
- [x] Sidebar: size charts, search synonyms, store credit balances and ad
      accounts no longer have their own line (`under` in lib/navigation.ts);
      they are reached from Products, «الولاء والمكافآت» tabs and Ad spend.
- [x] 228 Business customers: «بيانات الشركة» card on the customer page
      (company, tax ID, exemption + note), company lines on the order page;
      storefront company card on the account profile (saved through the
      same-origin PUT relay — the API's CORS has no PUT), checkout «الضريبة —
      معفى» for an exempt signed-in shopper.
- [x] 229 Pay on account: «الدفع الآجل» card on the customer page (limit,
      terms, statement, «سجّل دفعة»), Customers → «حسابات الآجل»
      (?tab=on-account), «دفع آجل» on the manual order screen and a card on
      the order page; storefront /account/on-account, checkout method «ادفع
      آجل» with its refusals (exclusive of gift card / points / credit).
- [x] 227 Scheduled sales: /offers/scheduled-sales (card in the Offers hub;
      editor with preview, store-clock times, stop / cancel), sale note on the
      product page; the slow-stock report links to …/new?product=<id>.
- [x] 234 Price history card on the product page (step chart + changes);
      storefront «أقل سعر في آخر 30 يوم» on the product page and cards.
- [x] 231 Specifications: /catalog/specifications (keys), section on the
      product page; storefront specs table, compare tray and /compare, listing
      filters (?spec=).
- [x] 223 Bought together: settings card under Offers → Cross-sell, pins via
      ?pin=<id>, «Bought with» on the product page; storefront strip.
- [x] 224 Stock forecast: Inventory → «توقّع المخزون» (/inventory/forecast),
      settings dialog, tick rows → draft purchase order, card on the product page.
- [x] 230 Lots & expiry: Inventory → «الدفعات والصلاحية» (/inventory/lots),
      receive a lot, edit, write off, expiry warning days, lots on the product
      page and under pick-list lines.
- [x] 243 + 295 + 297 Bulk update from a sheet: Products → «تحديث جماعي من
      شيت» (/catalog/bulk-update): template, .csv/.xlsx upload, preview tabs,
      apply once per upload (Idempotency-Key), result.
- [x] 253 Cart offers: /offers/cart-offers (card in the Offers hub; rules
      list + editor); storefront offer cards in the cart drawer and cart page
      (take the offer, over-max note, locked hint), «شوف النتايج» → report 256.
- [x] 258 Spin to win: /offers/spin-wheel (slices, live chances, SVG preview,
      stats); storefront popup dialog after the delay (phone, consent tick,
      result with copy; reduced motion; never on cart / checkout / funnels).
- [x] 259 «العرض» column in the order export — already offered by the export
      picker (nothing to change).
- [x] 260 Lost orders export as Excel or CSV; «تحديث من ملف» accepts .xlsx.
- [x] 298 Order email test goes to the signed-in person or a chosen teammate.
- [x] 304 Webhook custom header value: hint, client check, server 422 mapped.
- [x] 305 Buy a domain: «مش متاح دلوقتي — اربط دومين عندك» on 503, endings hint.
- [x] 273–274 `ORDER_TENDER_RETURNED` wording on reopen / bulk / correction
      (the refund destinations were already in the 204 refund dialog).

## Handoff items 302–408 + go-live AI errors (local desktop chat, 2026-10-08, working tree only, not committed)
Nine parallel groups; every heading handled. "stubbed" = seen only with stubbed answers (local limits:
online gateways off, no courier, one stock location, no second active account, no Google client).
- [x] Sign-in and team: 330, 331, 332, 347, 359, 346, 358 (/invites), 379 (ownership is now an offer).
      Second-account flows stubbed.
- [x] Subscription: 333, 334, 335, 336, 394, 397 — Settings → billing tabs; console /payment-methods,
      /payment-proofs. Transfer proofs, top-ups and the balance stubbed; 336 real on the spare store.
- [x] Console: 337, 338 (/notifications + bell), 405/408; 339 /site-traffic built, numbers stubbed, the
      marketing-site beacon never run.
- [x] Domains: 341, 325, 326, 385 (/domains/purchases/:id/dns), 395, 303. Owner step, prices and Brevo stubbed.
      Buy stays enabled on a null price only for the sandbox registrar.
- [x] Payments: 340 (real end to end), 382 (real), 381 (Settings → «ترقيم الطلبات»; the storefront no longer
      adds "#"), 320 (real), 384 + 377 (/payments/transactions; data stubbed), 364 (stubbed).
- [x] Shipping and returns: 372, 396, 387, 354 real; 375, 351, 352, 318 stubbed; 370 wording only.
- [x] Store and funnels: 373 (/trash), 376, 389 (/inventory/movements), 390, 401, 400, 393.
- [x] Messaging: 378 (real, sandbox), 383 (real), 391 (real submit), 386 (stubbed), 392 (stubbed push).
- [x] Checkout: 374, 353, 388 real; 348, 362, 363 stubbed; 302/322 partly (no websiteId from the API);
      355 and the dashboard half of 380 never opened in a browser.
- [x] Go-live AI errors: one shared wording in lib/errorMessages.ts (provider busy / not available / limits).
- [x] Small: checkout photo limit 5 MB; names for payment.disputed, return_approved, return_rejected.
Final check: typecheck dashboard / storefront / admin 0 errors; 23 dashboard routes and 9 storefront pages
swept with no console errors. Backend findings: docs/ux/backend-requests.md (2026-10-08 section).

## Round 3 (in progress)
- [x] W3-1 Wording pass 3: ~250 «جارٍ …» busy labels → Egyptian present
      («بنحفظ…»، «بنبعت…»، «بندوّر على طلبك…») and ~60 common «تم …» toasts
      («اتحفظ.»، «اتعمل «…».»، «اتنسخ اللينك») across 170 dashboard files;
      the lab (design-system) and the storefront text mirror
      (storeTextsCatalog.ts) left alone.
- [x] W3-3 Token fix: `--color-paper-sunken` was missing from the dashboard's
      @theme block since S1, so 61 `bg-paper-sunken` wells, hovers and
      skeletons rendered transparent; added. Three `*-warning` classes (no
      such token) → accent.
- [x] W3-2 «اختر» → «اختار», «أدخل» → «اكتب», «لا يوجد / لا توجد» → «مفيش»,
      and «مفيش … بعد.» → «مفيش … لسه.» (~400 strings, 140 files). Lines
      where Arabic text is an object key (presetCopy.ts maps Arabic preset
      copy to English) are skipped. An automatic «هذا X» → «X ده» reorder
      was tried and dropped: it split compound nouns («البريد الإلكتروني»)
      and caught «؟»; that needs a hand pass.

## Local verification setup (any new session)
- Postgres 16: `pg_ctlcluster 16 main start`; scratch DB `zimos_scratch`
  (postgres/postgres). Backend `.env` from `.env.example` with
  `DB_NAME=zimos_scratch`, raised `RATE_LIMIT_MAX`; `npx sequelize-cli
  db:migrate && db:seed:all`; demo login `demo@zimos.test` /
  `DemoPassw0rd!123` (username set to `demo` in the scratch DB).
- Dashboard: `apps/merchant-dashboard/.env` from `.env.example`;
  `npx vite --port 5173`. Screens checked with Playwright at 390 px and
  1366 px in Arabic.
- Platform admin: apps/platform-admin/.env from .env.example, npx vite
  --port 5174; the scratch demo user was given platform_role creator and
  platform_permissions {*} (scratch DB only).

## Backend requests
See `backend-requests.md` (first 6 done by the backend; 4 new from handoffs 175–176).

## Decisions
- 2026-10-06 Glass frame retired on this branch: the brief asks for a light
  neutral palette with very soft shadows; glass classes now resolve to
  opaque surfaces (06 §5).
- 2026-10-06 Dashboard defaults to Arabic when no language was chosen.
- 2026-10-06 Font: Readex Pro (already a dependency) for Arabic + Latin.
- 2026-10-06 No new dependencies so far.
- 2026-10-06 Product description no longer required on create: a frontend-only
  rule (backend allows ""); the guide promises name + price + photo.
- 2026-10-06 New products default to active (was draft) with a visible
  draft switch: the status default is a form default, not stock/pricing
  logic; the API accepts both (re-audit N-04).
- 2026-10-06 Unsaved-changes guard is beforeunload only: the app uses
  BrowserRouter (no data router), so in-app blocking (useBlocker) is not
  available without a router migration.

## Local UX pass — 2026-10-07 (desktop chat, working tree only, not committed)
Done in the main checkout on the owner's instruction to leave git to the cloud
loop. Source of truth for what changed: `git status` there. Audit and fix reports
live in that session's scratchpad, not in the repo.
- Liquid glass layer over the calm surfaces: `apps/merchant-dashboard/src/liquid-glass.css`,
  off switch in Settings → Account (`components/GlassToggle.tsx`). See UI_SYSTEM.md.
- Session: a refresh that gets no answer (429 rate limit, 5xx, offline) no longer
  signs the merchant out; only a refused token does (`packages/api-client/src/client.ts`,
  `context/AuthContext.tsx` retries /auth/me for up to a minute, then shows an
  «مش قادرين نوصل لزيموس» card with retry instead of the login page).
- UX audit of 43 routes at 390/1366 px (8 auditors, 76 findings: 2 blocker, 32 major).
  47 fixed in one batch: sticky `components/SaveBar.tsx` on product, shipping prices,
  fraud rules and store settings; manual order jumps to the first missing field;
  order items show price on phones and notes come right after the summary; home
  to-do no longer double-counts follow-ups; confirmation cards list what was ordered
  and hide team controls for a solo store; photo controls visible on touch; offers
  hub cards in a row; contacts get call/WhatsApp; Discounts and Team on DataTable;
  heatmap hours aligned, charts fixed-height with readable labels; activity rows link
  to their record; notification keys named; billing says the period ended; 44 px
  targets for call/WhatsApp, back link, bell, account, search, fields; Arabic digits
  in period labels and KPI counts.
- Second batch (same day): content-shaped loading in `DataState` and `DataTable`
  (`skeleton` / `loading` props); `PageHeader primaryAction` puts «أوردر جديد»,
  «ضيف منتج», «إضافة جهة اتصال» in a fixed bar above the phone tab bar; a shared
  leave guard (`lib/useUnsavedGuard.ts`) asks before a Shipping or Store-settings
  tab switch drops a draft; «الطلبات»→«الأوردرات» and «قمع»→«مسار» across customers,
  analytics, automations, stores; billing status words and a truthful amount label;
  confirmation cards cap at 4 lines; KpiCard `trend` sparkline; a warm pool in the
  glass backdrop and a focus glow on fields.
- Reviewed twice (adversarial review, 12 reviewers in all); everything confirmed was fixed,
  including: the session retry no longer races itself and shows a busy state;
  the field focus glow sits under the error/focus rings instead of replacing them;
  an assigned task on a solo store can be unassigned; «الافتراضي» is the one word
  for an option-less variant; the stock hint quotes the storefront's real badge.
- Not done: in-app route changes (sidebar links) are still not guarded — the app
  has no data router, so only tab switches and reload/close ask; Latin digits in a
  few remaining strings; "(SPEC §18.2)" text in the backend's automation templates;
  «هذه الفترة / هذا الشهر» range labels kept formal where «ده/دي» read oddly.
- Aurora look (same day, after the owner rejected the result as too timid): the glass layer now
  draws a real colour ground (brand, violet, pink, peach, sky), the page itself is one frosted
  pane beside the side menu and the top bar, buttons are pills with a sheen sweep, the current
  menu item / selected tab / main action share one brand gradient, home figures carry a %
  chip and an area sparkline, the orders header folds its secondary tools below 1536px.
  Contrast measured on rendered pixels (1,106 text runs, light and dark, desktop and phone).
  The brief for the page-by-page re-layout is docs/ux/REDESIGN_PROMPT.md; proof in docs/ui-lab/aurora.

## Full redesign (docs/ux/REDESIGN_PROMPT.md) — local desktop chat, working tree only, not committed

### Phase 1 — the system: shell, icons, motion (2026-10-08)
Pictures: `docs/ui-lab/redesign/phase-1/` (before / after, phone and desktop).
- **Icons.** `lucide-react` → Phosphor (`@phosphor-icons/react`) in all 357 dashboard files, through one map,
  `components/icons.ts` (semantic names; `fill` weight for the current state, `duotone` in empty states).
  Done by a type-checked codemod; `packages/ui` keeps its own internal glyphs.
- **Side menu**, Finder-style: seven headings (`lib/navigation.ts`, URLs unchanged, role rules unchanged),
  36px rows, the current row a filled pill, groups fold and remember, pinned shortcuts on top, apps / settings /
  support pinned at the bottom, count badges for calls due, orders to ship and unread messages
  (`lib/workCounts.ts`, one poll for the whole shell). Activity log and Refer & earn moved inside Settings → «كمان».
- **Phone dock** (`components/MobileTabBar.tsx`): a floating glass dock, five slots, the pressed icon swells,
  the current one is the filled glyph; «المزيد» opens the full menu as a bottom sheet.
- **Spotlight** (`components/CommandPalette.tsx`): recents, actions (new order, add product, theme, language…),
  pages, and orders / products / customers / funnels by number, phone or name — with call and WhatsApp on a
  customer row; arrows, Home / End, Enter, Esc.
- **Primitives**: `Sheet`, `QuickLook`, `ContextMenu`, sliding `Segmented`, `Popover`, `EditInPlace`, toasts with
  Undo; `Modal` and `ConfirmDialog` share the sheet's chrome. Notification Centre opens from the side, grouped by
  kind, each item with its action. Empty / error / no-permission states and the stat card (`KpiCard`) redrawn.
- **Motion and speed**: house curves in `index.css` (`--ease-spring`, `--ease-pop`, `--ease-out`), view transitions
  between pages (`lib/viewTransition.ts`, `components/ViewLink.tsx`), page code fetched on hover / touch-start
  (`lib/prefetch.ts`, `routes/prefetch.ts`), scroll restored on back (`lib/scrollRestore.ts`), lists kept for the
  session (`lib/useCachedAsync.ts`). The glass layer's new pieces are one file each in `src/glass/`.
- **Checks**: `tsc -b` clean; home, orders and settings at 390×844 touch and 1366×800, light and dark: no console
  errors, no failed requests, no horizontal scroll; contrast measured on rendered pixels for 2,080 text runs —
  under the floor only the merchant's own brand-colour preview in Settings (their colours) and one side-menu
  heading while it passes under the list's edge fade; glass off solid; reduced motion: nothing running; English
  reads left-to-right with no Arabic left in the chrome.

Decisions
- 2026-10-08 Dock refraction (the SVG displacement filter of the owner's `liquid-glass` reference) is on for fine
  pointers only: a software displacement filter re-run on every scrolled frame would cost a mid-range Android its
  60fps. Touch devices get the same dock without it.
- 2026-10-08 The glass layer's shell pieces live in `src/glass/*.css` (same switch as `liquid-glass.css`), one
  file per component, so parallel builders never edit one stylesheet.
- 2026-10-08 Offers, discounts and gift cards stay three rows under المنتجات until the Phase 4 hub; the report
  pages stay separate rows under الفلوس والتقارير until the Phase 5 hub — nothing is unreachable meanwhile.
- 2026-10-08 Empty order stages keep full-strength words on a dashed chip instead of 60% opacity (it fell to 2.8:1).
- 2026-10-08 Phosphor is imported per icon (`@phosphor-icons/react/dist/csr/<Name>`) so the dev server does not
  bundle the whole family.

### Phase 2 — Home: «اليوم» (2026-10-08)
Pictures: `docs/ui-lab/redesign/phase-2/`. Design and data map: the session's `phase2-brief.md`; what the API
does not give yet: `docs/ux/needs-backend.md` (H1–H23).
- The page (`pages/DashboardHomePage.tsx`) is the merchant's day in order, each section its own file under
  `pages/home/today/`, loading on its own (cached, skeleton in the shape of what comes, a 403 hides the section,
  any other failure shows a line with retry): header with the range (opens on **today**) and a live chip →
  **«مستنيك دلوقتي»** (one gradient card; a row per kind of work with its count, the age of the oldest or the money
  at stake, and one button; ranked by how late it is; calls, no courier, failed deliveries, returns, transfers,
  stock, messages, abandoned checkouts) → four stat cards against yesterday at the same hour (7 / 30 days: against
  the period before) → **«فلوسك»** (net profit with incomplete costs called out and linked, cash with couriers and
  how old, settled this week) → **«رحلة الأوردر»** (placed → confirmed → shipped → delivered, the rates the API
  gives, and the weakest step in one sentence with its reason) → ads (cost per delivered order, best / worst
  campaign; a connect row otherwise) → products (top by delivered profit, running out, coming back) → latest orders
  with call / WhatsApp, Quick Look and a context menu → the setup guide as one slim row after the first order.
- Everything the old home showed is on the page or one tap away: visits, the store funnel, offers, sources,
  governorates, devices and the product / store filters are under «كل الأرقام بالتفصيل» (closed, loads when opened).
  The old tiles (`HomeAnswers`, `QuickActions`, `Bento`) are removed.
- Checks: `tsc -b` clean; home at 390×844 touch and 1366×800, light and dark, today and 30 days: no console errors,
  no failed requests, no horizontal scroll; 910 text runs measured on rendered pixels, none under the floor (the
  check now leaves out text covered by a floating bar or inside a scroller's edge fade); glass off solid; reduced
  motion: nothing running; English left-to-right.

Decisions
- 2026-10-08 "Confirmed today" and "handed to couriers today" do not exist as events in the API: the two cards
  say how many of the range's orders are confirmed / with a courier so far, in words, with no invented comparison.
- 2026-10-08 No "next settlement" tile (no payout schedule exists): cash held and its age, and what was settled
  this week, stand in.
- 2026-10-08 Between "confirmed" and "shipped" the journey shows an arrow and no rate (the API gives none).
- 2026-10-08 The range opens on today on every visit; the old per-store memory of the period is gone.
- Phone length (390 px wide, measured): the first build of the new home was 4,660 px; after putting the two
  money cards side by side, the journey in one compact row and the three product cards in one snap row it is
  3,100 px on "today" and 3,580 px on 30 days (the old home was 2,715 px with a third of the content).

### Phase 3 — Orders: the flow that makes the money (2026-10-08)
Pictures: `docs/ui-lab/redesign/phase-3/`. Feature inventories used so nothing was dropped: the session's
`inventories/orders.md` and `inventories/confirmation-lost-returns-fraud.md` (each builder ticked its items).
- **Shared first**: the list kit every list page now uses (`components/list/`: `ListToolbar`, `ChipRow`,
  `BulkBar`, `FilterSheet`, `ListRowCard`, `ListSkeleton`), `components/Accordion.tsx`, and shared-element view
  transitions (a row's name, amount and status chip travel into the detail header — `markViewSource`).
- **Orders list**: four blocks before the first order instead of up to eleven — title with one «أدوات» menu, search
  + ONE Filters sheet (saved views, date, risk, sort, the 15 filters, columns, page size — now on a phone too),
  stage chips with counts in one scrolling row (empty stages behind «كمان»), active-filter chips. Rows lead with the
  customer and the amount; call / WhatsApp on desktop rows as well; a row opens Quick Look; right-click / long-press
  menu; a floating bulk bar. Phone list 10,890 → 6,566 px, desktop 6,052 → 4,366 px.
- **Confirmation queue**: a calling station — one order at a time (who, their history with the store, what, how
  much, where), big buttons (call, WhatsApp, confirmed, no answer, call later, cancelled), the next order slides in,
  session progress, keyboard shortcuts on desktop. The old list stays one switch away. Phone 14,477 px → one screen.
- **Order page**: hero (who · how much · where · the next step as one button), then items, money and notes;
  everything else folds into accordions with a one-line summary; status changes from the chip with Undo when the
  server allows going back. Phone 5,665 → 3,182 px.
- **Create order**: a sheet over the list in three steps (customer → products → delivery and payment), a searchable
  product picker, the running total from the server in the footer, the draft kept per store.
- **Lost orders, returns, protection**: the same list pattern, each row with its one action; protection rules fold
  into six sections with a summary each.
- Checks: `tsc -b` clean; orders, an order page, the queue, lost orders, returns and protection at 390×844 touch and
  1366×800, light and dark: no console errors, no failed requests, no horizontal scroll; 1,938 text runs measured,
  one under the floor (lost-orders secondary text on a dark row, 4.28:1) fixed and re-measured; glass off solid;
  reduced motion: nothing running; English left-to-right with no Arabic left in the chrome.

Decisions
- 2026-10-08 Bulk "ship" now preselects the first connected courier (it used to open on "other, type a name"); the
  batch preview still has to be confirmed.
- 2026-10-08 The orders table's customer, amount, status and place are fixed columns; the default optional set is
  products only, so the table fits 1366 px without scrolling.
- 2026-10-08 On a narrow station card the amount and the place come before the items, so they never sit under a
  scrolling list.
- 2026-10-08 Sheets use `overflow: clip` on their viewport: a hidden box was being scrolled by focus while the sheet
  rose, leaving it shifted up with a gap under it.
Open
- The orders table still scrolls sideways between 768 and about 1,000 px wide.
- A confirmation task carries no line image, so the station shows the package tile for every item.
- `pages/orders/packing/packingStrings.ts` still says «للطلب» in the bulk menu (Phase 10 word sweep).

### Phase 5 — Reports: one hub that answers questions (2026-10-08)
Pictures: `docs/ui-lab/redesign/phase-5/`. Feature inventory used so nothing was dropped: the session's
`inventories/reports.md` (each tab builder ticked its items).
- **One page, seven tabs**, each named after the question it answers: المبيعات والربح «كسبت كام فعلاً؟» · رحلة
  الأوردر «الأوردرات بتضيع مني فين؟» · الإعلانات «أنهي حملة بتكسّب؟» · المنتجات · العملاء · المتجر · دلوقتي. One range
  and one comparison for the whole hub, kept in the address and carried from tab to tab.
- **Every tab has the same anatomy** (the report kit, `components/report/`): a KPI strip, ONE chart, ONE sortable
  table with CSV, ONE sentence that says what the numbers mean and what to do, then «تفاصيل أكتر» (closed, loads
  when opened) and links to the side reports. Six separate report screens became one.
- **Old addresses still work**: `/analytics/summary`, `/analytics/web`, `/analytics/attribution`,
  `/analytics/realtime` and `/analytics/search` open the tab that took them over, with their query string. The
  side menu has one «التقارير» row; the old rows are still found by search.
- Checks: `tsc -b` clean; the seven tabs at 390×844 touch and 1366×800, light and dark: no console errors, no
  failed requests, no horizontal scroll; 4,056 text runs measured on rendered pixels, none under the floor once
  the check learned that chart text is painted with `fill`; glass off solid; reduced motion: nothing running;
  English left-to-right with no Arabic left in the chrome.

Decisions
- 2026-10-08 A conversion rate over 100% (more orders than counted visits: orders typed in by the merchant) is
  shown as «—» with the reason, not as a figure like 1,114%.
- 2026-10-08 «الأرباح» keeps its own menu row; the sales tab shows the headline profit and links to it.
- 2026-10-08 The order-journey tab shows no comparison chips: the API has no previous period for delivery.
Open
- The old report screens' files are still in the repo, unrouted, because the tabs import helpers from them.
- Backend lines R13–R31 in `docs/ux/needs-backend.md` (profit comparison, per-edge counts, ad platform connect…).

### Phases 4, 6, 7, 8, 9, 10 — built and checked together (2026-10-08)
Pictures: `docs/ui-lab/redesign/phase-4/` … `phase-10/`. A network failure cut off the first run of phases 4, 6
and 9; the cut-off builders were restarted from the files already on disk.
- **Phase 4 — products and selling**: catalog on the list pattern (price and stock edited in place, Quick Look,
  grid / list), the product page in sections with a photo grid and a variants grid, one «العروض والخصومات» hub
  (discounts and gift cards under it in the menu), customers list and a customer page with a call bar.
- **Phase 6 — store editor**: one toolbar, sections list on one side, the store in the middle, the look on the
  other; on a phone the store fills the screen with three buttons under it. Draft autosaves; publish goes through a
  sheet that lists what changed; version history with roll back.
- **Phase 7 — funnel builder**: `FunnelEditorPage.tsx` split by zone (1,772 → 494 lines); the map with cards,
  labelled arrows and "+" on arrows, pan and pinch; steps and inspector as panes (sheets on a phone); settings,
  emails, tests and countries in a side sheet; the list and a three-question wizard.
- **Phase 8 — settings**: Settings (25 sections, account split in five), store settings (17 sections), shipping
  (default price first, governorates as one table), payments and apps on the System Settings layout
  (`components/settings/`). Account → devices on a phone 35,274 → 1,399 px; shipping 4,634 → 1,050 px.
- **Phase 9 — storefront**: swipe gallery, option chips, sticky order bar, trust lines; cart that answers on tap;
  one-page checkout; tracking as a timeline.
- **Phase 10 — sweep**: 107 rows in `docs/ux/sweep-table.md` (97 done, 10 partial with what is left).
- Checks run: `tsc -b` (dashboard) and `tsc --noEmit` (storefront) clean. 22 dashboard pages from phases 4, 6, 7
  and 10 at both sizes, light and dark: no horizontal scroll; 5,591 text runs measured, 9 under the floor — 8 on
  the offers hub (fixed and re-measured) and one chip on the orders board (open); glass off solid on all 22.
  Settings, shipping and payments measured clean; the apps page was fixed for a phone overflow and re-measured on
  desktop only.

Open (not done or not verified)
- Storefront: contrast was not measured (the check script signs in to the dashboard only); one 404 in the console
  is not traced; the order-confirmation page was not captured.
- Editor: a loading spinner was still turning under reduced motion at capture time; a hydration warning comes
  from the store inside the preview and is not traced.
- English: template category names on `/website` and the font samples in the editor still show Arabic.
- Orders board: the «عميل جديد» chip measures 3.59:1 on a light column.
- A product image request to `/uploads/…` is blocked cross-origin on the dev server.
- The demo funnel's cards overlap on the map with their saved positions; «رتّب الخريطة» was not tried.
- Only a sample of the swept pages was opened in a browser; the rest are typechecked only.
- `lucide-react` is still in the dashboard's package.json; old unrouted report screens are still in the repo.

### Follow-up pass on the open list (2026-10-09)
- All 102 parameterless dashboard routes opened on a phone and a desktop: no crash screen, no console error, no
  failed request, no horizontal scroll (`scratchpad/shots/smoke.cjs`).
- Storefront: the 404 on checkout is by design (`pickup/locations` and `delivery-slots` answer 404 while the
  feature is off) and predates the redesign. Contrast measured on six shopper pages: the misses are the demo
  store's own brand colour (#E4572E as text on white 3.68:1, dark text on it 4.48:1) — a merchant setting the
  editor already warns about — and text under the sticky order bar, which the script does not exclude there.
- Reduced motion: three spinners had no guard (the preview's refresh icon, the shared `Spinner` in packages/ui,
  the username check); the editor now reports nothing running.
- Offers hub group counts and the apps page on a phone re-measured: clean.
- Orders board: the two chips still reported sit in a column's bottom fade (a measuring artefact, same as the
  side menu's); the chips got a white veil under their tint in light mode anyway.
- English: the Arabic left on `/website` is template category names from the API, and the editor's «Aa أب» is
  the font sample — data, not untranslated chrome.
Still open
- The order-confirmation page was not captured (it needs a test order placed on the demo store).
- Funnel map: after «رتّب الخريطة» the branch row sits 4px under the first row and an arrow's pill can cover a
  card's title; the layout constants are pinned by `funnelFlow.test.ts`.
- The ten `partial` rows in `sweep-table.md`; `lucide-react` still listed in the dashboard's package.json (no
  imports left; removing it means touching the lockfile); old unrouted report screens still in the repo.

### Editors: font, one-click editing, map smoothness (2026-10-09)
- **Arabic face**: IBM Plex Sans Arabic (Arabic subset only) with Inter for Latin, replacing Readex Pro in the
  dashboard (`index.css`; new package `@fontsource/ibm-plex-sans-arabic`). Contrast re-measured on 17 screens
  (6,050 text runs): clean apart from the merchant brand-colour preview in Settings.
- **Store editor / step page editor** (`apps/storefront/src/components/preview/PreviewBridge.tsx`): one click on
  an element picks that element (it used to pick the section first); the section's action bar steps aside while
  an element is picked, so it no longer covers the text being edited.
- **Funnel map**: opens at 100% on a desktop (fitted on a phone); the floating bars are no longer blurred and
  cards use layout containment. Measured on the built dashboard (`vite build`, served on :4173) under a 4x CPU
  slowdown: panning went from 49 slow frames (>33 ms) to 9 of ~200; dragging a card is still 81 slow frames of
  277, zooming 15 of 84. Unthrottled it is 60 fps throughout.
Open
- Dragging a card on a slow device still stutters; the per-frame React render of the map is the suspect, not
  yet profiled. The store editor's own smoothness was not measured.
- Clicking an element inside a funnel step's page was not exercised by script (the editor opens and shows the
  page; the click test did not find the preview frame).
- A leftover auto-saved draft from an earlier tidy test on the demo funnel was discarded.

### New logo, template gallery, picture-less story (2026-10-09)
- **Logo**: the sliced Z of the 2026 identity (five lanes; the Z is the first letter of the name) in ZIMOS's own
  palette — navy lanes with a Product Blue lane on light, white with a Cyan lane on dark; the identity's orange,
  ink and typefaces are NOT adopted. Drawn in `brand/ZimosBrand.tsx` and copied to the storefront, marketing
  site and admin console; favicons, app icons and the PNG exports in every `public/brand` redrawn.
- **Template gallery**: a card shows a small store in the template's own colour and name until its live render
  arrives (it used to be the same grey sketch on all 17); four renders load at a time; the poster stays until
  the store has painted.
- **Storefront**: a "scroll story" with no pictures is told as a list instead of beside an empty frame.
- **Funnel map**: the dragged card follows the pointer by a compositor translate while React re-draws the
  arrows about 20 times a second. A CPU profile of the drag shows ~1 s of script in 5.4 s; the rest is
  rendering in a headless browser without a GPU, so the remaining stutter there cannot be judged from here.
Decisions
- Template content was left as it is: the seeds already hold ten differently built stores; what makes them
  look thin is that they ship without pictures (by their own rule) and that a preview uses the store's colour.
- No store was deleted.
