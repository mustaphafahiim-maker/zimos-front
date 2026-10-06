import { useCallback } from "react";
import {
  ApiError,
  apiErrorCode,
  apiErrorDetails,
  type ApiErrorCode,
  type CarrierCancelFailedDetails,
} from "@store-builder/api-client";
import { fmt, getLocale } from "@/i18n/LocaleContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { providerName } from "@/lib/providers";
import { formatDate } from "@/lib/format";

/**
 * Translated copy for the backend's stable error codes.
 *
 * Every code the dashboard can meet gets its own sentence here, so a known
 * failure never reaches the merchant as the server's English text or as a
 * generic "something went wrong". Screens that need a sharper message for a
 * code in their own context pass it as an override to `useErrorMessage`.
 *
 * Deliberately absent: CARRIER_ERROR. Its server message is the courier's own
 * words (and may say the delivery could already exist at the courier), so it
 * is shown verbatim — see `VERBATIM_CODES`.
 */
const STRINGS = {
  en: {
    network: "Can't reach the server. Check your connection and try again.",
    generic: "Something went wrong. Please try again.",
    VALIDATION_ERROR: "Some fields need attention. Check the highlighted values and try again.",
    UNAUTHENTICATED: "Your session has ended. Sign in again to continue.",
    FORBIDDEN: "You don't have permission to do that. Ask the store owner to update your role.",
    APP_NOT_INSTALLED: "This needs an app your store has uninstalled. Install it again from the Apps page.",
    SUBSCRIPTION_REQUIRED:
      "Your subscription has expired, so new products and funnels can't be created until it's renewed. Existing products, funnels and orders keep working — see Settings → Plan & billing.",
    STORE_SUSPENDED:
      "This store has been suspended by Zimos, so new products and funnels can't be created. Contact Zimos support.",
    NOT_FOUND: "We couldn't find that. It may have been deleted.",
    CONFLICT: "This changed in the meantime. Reload and try again.",
    RATE_LIMITED: "Too many requests. Wait a moment and try again.",
    IDEMPOTENCY_KEY_CONFLICT: "This request was already sent. Reload to see the result.",
    INSUFFICIENT_STOCK: "There isn't enough stock for this.",
    DUPLICATE_RESOURCE: "That already exists.",
    INVALID_REFERENCE: "Something this depends on no longer exists. Reload and try again.",
    INTERNAL_SERVER_ERROR: "The server hit an unexpected error. Please try again.",
    ORDER_CANCELLED: "This order is cancelled, so it can't be changed.",
    ORDER_ALREADY_CANCELLED: "This order is already cancelled.",
    ORDER_ALREADY_SHIPPED: "This order has already shipped and can no longer be changed. Open a return instead.",
    ORDER_NOT_CONFIRMED: "Confirm this cash-on-delivery order before booking a courier.",
    ORDER_NOT_PAID: "This prepaid order must be paid before booking a courier.",
    SHIPMENT_ALREADY_EXISTS: "This order already has an active shipment. Cancel it before adding another.",
    CARRIER_NAME_RESERVED: "That's a connected courier's name. Choose the courier's own option to ship with it.",
    SHIPPING_ADDRESS_REQUIRED: "This order has no shipping address. Add one first.",
    ORDER_NOT_COD: "Only cash-on-delivery orders are confirmed by phone.",
    ORDER_ALREADY_CONFIRMED: "This order is already confirmed.",
    TASK_ALREADY_LOCKED: "Another agent is working on this order right now.",
    TASK_ALREADY_DONE: "This order already has a final outcome. Reload to see it.",
    TASK_NOT_LOCKED_BY_YOU: "Your claim on this order ran out and someone else took it. Reload the queue.",
    TASK_NOT_CLAIMED: "Nobody is working on this order anymore.",
    TASK_NOT_DONE: "This order is still in the queue. Record an outcome instead.",
    OUTCOME_UNCHANGED: "The order already has that outcome.",
    CORRECTION_NOT_ALLOWED: "This outcome can't be changed: the order was cancelled from the order page.",
    ORDER_REJECTED: "This order couldn't be placed.",
    INVALID_PHONE: "Enter a valid phone number.",
    CART_NOT_FOUND: "That cart no longer exists.",
    CART_TOKEN_OR_ITEM_REQUIRED: "There's nothing to check out.",
    STEP_MISMATCH: "This page is out of date. Reload to continue.",
    FUNNEL_PAUSED: "This funnel is paused.",
    PAGE_PATH_RESERVED: "That path is reserved for a built-in store page. Choose a different one.",
    PRODUCT_HAS_ORDERS: "This product has orders, so it can only be archived.",
    PRODUCT_IN_FUNNEL: "This product is used in a funnel. Remove it from the funnel first.",
    PRODUCT_NOT_ARCHIVED: "Only an archived product can be restored.",
    SMART_COLLECTION:
      "This collection fills itself from its rules, so products can't be added or removed by hand. Change its rules or the products' tags instead.",
    NOT_SMART_COLLECTION: "This collection is manual, so it has no rules to refresh from.",
    CARRIERS_NOT_CONFIGURED: "Courier integrations aren't available on this server yet. Please contact support.",
    CARRIER_AUTH_FAILED: "The courier rejected the API key. Check it in the courier's dashboard and connect again.",
    CARRIER_PERMISSION_DENIED:
      "The courier accepted the login, but it hasn't enabled API access for this account. Your details are correct: ask the courier to enable API access for your account, then try again.",
    CARRIER_SANDBOX_NOT_ALLOWED:
      "This courier connection uses the courier's sandbox, which only creates test shipments, so nothing was booked. A production account is required: connect one under Shipping.",
    CARRIER_ADDRESS_UNMATCHED: "The order's address couldn't be matched to the courier's list. Choose the delivery area.",
    CARRIER_ADDRESS_NAMES_REQUIRED:
      "The courier doesn't share its address list with this account. Type the governorate, city and area as the courier spells them.",
    CARRIER_ADDRESS_REJECTED: "The courier didn't recognise the delivery address. Check the spelling and try again.",
    CARRIER_CURRENCY_UNSUPPORTED: "This courier only collects cash in EGP, and this order is in another currency.",
    SHIPPING_GROUP_CURRENCY: "A group priced in another currency than the store's is for funnels only: take its products out, or keep it in the store's currency.",
    CARRIER_COD_LIMIT: "The cash-on-delivery amount is above this courier's limit.",
    CARRIER_NOT_CONNECTED: "This courier isn't connected to your store anymore.",
    CARRIER_CANCEL_FAILED: "The courier didn't cancel the shipment, so nothing was changed.",
    CARRIER_CREDENTIALS_UNREADABLE: "The saved courier key can't be read anymore. Connect the courier again.",
    SHIPMENT_NOT_CARRIER_MANAGED: "This shipment wasn't booked through a connected courier.",
    LABEL_NOT_AVAILABLE: "This courier doesn't provide printable labels.",
    CARRIER_TIER_UNMAPPED: "This weight tier has no package type for the courier. Book it as another tier, or map it in the courier settings.",
    CARRIER_MANUAL_CANCEL_REQUIRED:
      "This courier can't cancel deliveries from here. Cancel the delivery in the courier's dashboard first, then confirm it here.",
    CARRIER_CONNECT_CONFLICT:
      "This courier was connected from another tab or by a teammate at the same moment, so this save didn't go through. Reload to see the connection, then save again if you need to.",
    CARRIER_BOOKING_NOT_SAVED:
      "The courier created the delivery, but it couldn't be saved here. Cancel it in the courier's dashboard, then book the order again.",
    SHIPPING_TIERS_REQUIRED: "Add at least one weight tier before pricing shipping by weight.",
    DEFAULT_ITEM_WEIGHT_REQUIRED: "Set a default item weight first. It's required while shipping is priced by weight tier.",
    // handoff 184
    ADDRESS_LOOKUP_KEY_REQUIRED: "Add your Google API key to use Google Maps suggestions.",
    ADDRESS_LOOKUP_INVALID_KEY:
      "Google refused this key. Check you copied it whole and that the Places API (New) is turned on for it in your Google Cloud console.",
    ADDRESS_LOOKUP_UNAVAILABLE: "We couldn't reach Google to check the key. Try again in a few minutes.",
    GATEWAYS_NOT_CONFIGURED: "Online payments aren't available on this server yet. Please contact support.",
    GATEWAY_AUTH_FAILED: "The payment gateway rejected these keys. Copy them again from its dashboard and reconnect.",
    GATEWAY_KEYS_MODE_MISMATCH: "One key is a test key and the other a live key. Use both from the same mode.",
    GATEWAY_KEYS_UNRECOGNISED: "These don't look like keys from this gateway. Check you copied the right ones.",
    GATEWAY_NOT_CONNECTED: "This payment gateway isn't connected to your store anymore.",
    GATEWAY_HAS_PENDING_PAYMENTS: "Some orders are still waiting on a payment through this gateway. Wait until they're paid or expire, then disconnect.",
    GATEWAY_CREDENTIALS_UNREADABLE: "The saved gateway keys can't be read anymore. Connect the gateway again.",
    PAYMENT_METHOD_UNAVAILABLE: "That payment method isn't available right now.",
    REFUND_EXCEEDS_ELIGIBLE_AMOUNT: "That's more than can still be refunded on this order.",
    REFUND_EXCEEDS_PAYMENT: "No single payment has that much left. Refund each payment separately.",
    REFUND_PAYMENT_INVALID: "That payment can't be refunded through the gateway.",
    ORDER_TEST_PAYMENT: "This order was paid in test mode, so it can't be shipped.",
    PLAN_LIMIT_REACHED: "Your plan's limit has been reached. Upgrade your plan to add more.",
    STORE_NOT_SET_UP: "Set up your store (add a product) before connecting a domain.",
    DOMAIN_TAKEN: "That domain is already connected to a store.",
    DOMAIN_PRICE_CHANGED: "The price changed — check it and confirm again.",
    DOMAIN_UNAVAILABLE: "This domain isn't available anymore. Search for another name.",
    DOMAIN_PURCHASE_FAILED: "The domain couldn't be bought — nothing was charged. Try again in a few minutes.",
    DOMAIN_NOT_ACTIVE: "Only a bought domain that's active or expired can be renewed.",
    TRIAL_NOT_AVAILABLE: "The free trial isn't available for this account.",
    EMAIL_DOMAIN_TAKEN: "Another store already sends from this domain.",
    draftRequired: "Your store is in draft mode. Subscribe to publish it.",
    limitFunnels: "You've reached your plan's funnels for this month ({used} of {max}). You can create more from {date}.",
    limitStores: "You've reached your plan's store limit ({used} of {max}). Upgrade one of your stores' plans to add another.",
    limitDrafts: "Subscribe to one of your stores before starting another.",
    limitDomains: "You've reached your plan's domain limit ({used} of {max}). Upgrade your plan to add another.",
    cancelFailedPermission:
      "The courier refused to cancel the delivery: the connected API key doesn't have Full Access. The order was not cancelled. Reconnect the courier with a Full Access key under Shipping, or cancel the delivery in the courier's dashboard first.",
    cancelFailedAuth:
      "The courier rejected the saved API key, so the delivery wasn't cancelled and the order is unchanged. Reconnect the courier under Shipping.",
    courierReply: "Courier's reply: {message}",
    carrierPermissionNamed:
      "{name} accepted the login, but it hasn't enabled API access for this account. Your details are correct: ask {name} to enable API access for your account, then try again.",
    carrierPermissionBosta:
      "Bosta refused this action for the connected API key. Check the key's access level in Bosta's dashboard, or reconnect with a Full Access key.",
    carrierSandboxNamed:
      "This {name} connection uses the {name} sandbox, which only creates test shipments, so nothing was booked. A production {name} account is required: connect one under Shipping.",
    cancelFailedApiAccess:
      "{name} refused to cancel the delivery: it hasn't enabled API access for this account. The order was not cancelled. Ask {name} to enable API access, or cancel the delivery in {name}'s dashboard first.",
  },
  ar: {
    network: "النت فصل أو السيرفر مش بيرد. اتأكد من الاتصال وجرّب تاني.",
    generic: "حصلت مشكلة عندنا. جرّب تاني بعد شوية.",
    VALIDATION_ERROR: "فيه خانات محتاجة تتظبط — معلّمة باللون الأحمر. صلّحها وجرّب تاني.",
    UNAUTHENTICATED: "الجلسة خلصت. ادخل تاني وهترجع لنفس المكان.",
    FORBIDDEN: "الحاجة دي مش ضمن صلاحياتك. اطلب من صاحب المتجر يفتحهالك.",
    APP_NOT_INSTALLED: "ده محتاج تطبيق إنت شلته من متجرك. نزّله تاني من صفحة التطبيقات.",
    SUBSCRIPTION_REQUIRED:
      "اشتراكك خلص، فمش هتقدر تضيف منتجات أو مسارات بيع جديدة لحد ما تجدّده. المنتجات والمسارات والأوردرات اللي عندك شغالة عادي — جدّد من الإعدادات ← الباقة والفواتير.",
    STORE_SUSPENDED: "زيموس وقّفت المتجر ده، فمش هتقدر تضيف منتجات أو مسارات بيع جديدة. كلّم دعم زيموس.",
    NOT_FOUND: "مش لاقيين الحاجة دي. ممكن تكون اتمسحت.",
    CONFLICT: "حد عدّل هنا في نفس الوقت. اعمل تحديث للصفحة وجرّب تاني.",
    RATE_LIMITED: "طلبات كتير ورا بعض. استنى دقيقة وجرّب تاني.",
    IDEMPOTENCY_KEY_CONFLICT: "الطلب ده اتبعت قبل كده. اعمل تحديث للصفحة وشوف النتيجة.",
    INSUFFICIENT_STOCK: "الكمية دي مش موجودة في المخزن.",
    DUPLICATE_RESOURCE: "ده موجود قبل كده.",
    INVALID_REFERENCE: "حاجة مربوطة بده اتمسحت. اعمل تحديث للصفحة وجرّب تاني.",
    INTERNAL_SERVER_ERROR: "حصلت مشكلة في السيرفر. جرّب تاني بعد شوية.",
    ORDER_CANCELLED: "الأوردر ده ملغي، فمينفعش يتعدّل.",
    ORDER_ALREADY_CANCELLED: "الأوردر ده ملغي أصلًا.",
    ORDER_ALREADY_SHIPPED: "الأوردر ده اتشحن خلاص ومينفعش يتعدّل. افتح مرتجع بداله.",
    ORDER_NOT_CONFIRMED: "أكّد الأوردر الأول (دفع عند الاستلام) قبل ما تحجز المندوب.",
    ORDER_NOT_PAID: "الأوردر ده مدفوع أونلاين ولسه متدفعش. استنى الدفع قبل ما تحجز المندوب.",
    SHIPMENT_ALREADY_EXISTS: "الأوردر ده ليه شحنة شغالة. الغيها الأول لو عايز تعمل واحدة تانية.",
    CARRIER_NAME_RESERVED: "ده اسم شركة شحن ممكن تربطها. اختارها من القايمة عشان تشحن معاها.",
    SHIPPING_ADDRESS_REQUIRED: "الأوردر ده مالوش عنوان شحن. ضيف العنوان الأول.",
    ORDER_NOT_COD: "أوردرات الدفع عند الاستلام بس هي اللي بتتأكد بالتليفون.",
    ORDER_ALREADY_CONFIRMED: "الأوردر ده متأكد خلاص.",
    TASK_ALREADY_LOCKED: "فيه زميل شغال على الأوردر ده دلوقتي.",
    TASK_ALREADY_DONE: "الأوردر ده اتسجّلت نتيجته خلاص. اعمل تحديث للصفحة وشوفها.",
    TASK_NOT_LOCKED_BY_YOU: "وقتك على الأوردر ده خلص وزميل تاني أخده. اعمل تحديث للقايمة.",
    TASK_NOT_CLAIMED: "محدش شغال على الأوردر ده دلوقتي.",
    TASK_NOT_DONE: "الأوردر ده لسه في القايمة. سجّل نتيجة المكالمة الأول.",
    OUTCOME_UNCHANGED: "دي نفس نتيجة الأوردر اللي متسجلة.",
    CORRECTION_NOT_ALLOWED: "مينفعش تغيّر النتيجة دي: الأوردر اتلغى من صفحته.",
    ORDER_REJECTED: "مقدرناش نسجّل الأوردر ده.",
    INVALID_PHONE: "اكتب رقم موبايل صحيح.",
    CART_NOT_FOUND: "السلة دي مبقتش موجودة.",
    CART_TOKEN_OR_ITEM_REQUIRED: "مفيش حاجة في السلة تطلبها.",
    STEP_MISMATCH: "الصفحة دي قديمة. اعمل تحديث وكمّل.",
    FUNNEL_PAUSED: "مسار البيع ده موقوف دلوقتي.",
    PAGE_PATH_RESERVED: "اللينك ده محجوز لصفحة أساسية في المتجر. اختار لينك تاني.",
    PRODUCT_HAS_ORDERS: "المنتج ده عليه أوردرات، فينفع تأرشفه بس مش تمسحه.",
    PRODUCT_IN_FUNNEL: "المنتج ده مستخدم في مسار بيع. شيله من المسار الأول.",
    PRODUCT_NOT_ARCHIVED: "ينفع ترجّع المنتج المؤرشف بس.",
    SMART_COLLECTION: "المجموعة دي بتتملى لوحدها من الشروط بتاعتها، فمينفعش تضيف أو تشيل منتجات منها بإيدك. غيّر شروطها أو تاجز المنتجات.",
    NOT_SMART_COLLECTION: "المجموعة دي يدوية، فمفيهاش شروط تتحدّث منها.",
    CARRIERS_NOT_CONFIGURED: "ربط شركات الشحن لسه مش متاح هنا. كلّم الدعم.",
    CARRIER_AUTH_FAILED: "شركة الشحن رفضت المفتاح (API key). اتأكد منه في لوحة الشركة واربط تاني.",
    CARRIER_PERMISSION_DENIED:
      "شركة الشحن قبلت الدخول، بس لسه مفعّلتش الربط (API) لحسابك. بياناتك صح: اطلب منهم يفعّلوا الربط وجرّب تاني.",
    CARRIER_SANDBOX_NOT_ALLOWED:
      "الربط ده على حساب تجريبي (Sandbox) عند شركة الشحن، وده بيعمل شحنات تجريبية بس، فمفيش حاجة اتحجزت. محتاج حساب حقيقي (Production): اربطه من صفحة الشحن.",
    CARRIER_ADDRESS_UNMATCHED: "مقدرناش نطابق عنوان الأوردر مع مناطق شركة الشحن. اختار منطقة التوصيل بنفسك.",
    CARRIER_ADDRESS_NAMES_REQUIRED:
      "شركة الشحن مش بتشارك قايمة مناطقها مع الحساب ده. اكتب المحافظة والمدينة والمنطقة زي ما الشركة بتكتبها.",
    CARRIER_ADDRESS_REJECTED: "شركة الشحن معرفتش عنوان التوصيل. راجع الكتابة وجرّب تاني.",
    CARRIER_CURRENCY_UNSUPPORTED: "الشركة دي بتحصّل بالجنيه المصري بس، والأوردر ده بعملة تانية.",
    SHIPPING_GROUP_CURRENCY: "المجموعة اللي أسعارها بعملة غير عملة المتجر للفانلز بس: شيل منتجاتها، أو خليها بعملة المتجر.",
    CARRIER_COD_LIMIT: "مبلغ التحصيل أكبر من الحد المسموح عند شركة الشحن دي.",
    CARRIER_NOT_CONNECTED: "شركة الشحن دي مبقتش مربوطة بمتجرك.",
    CARRIER_CANCEL_FAILED: "شركة الشحن ملغتش الشحنة، فمفيش حاجة اتغيّرت.",
    CARRIER_CREDENTIALS_UNREADABLE: "مفتاح شركة الشحن المتسجل مبقاش بيتقري. اربط الشركة تاني.",
    SHIPMENT_NOT_CARRIER_MANAGED: "الشحنة دي متحجزتش عن طريق شركة شحن مربوطة.",
    LABEL_NOT_AVAILABLE: "الشركة دي مش بتوفّر بوليصة للطباعة.",
    CARRIER_TIER_UNMAPPED: "شريحة الوزن دي مالهاش نوع شحنة عند الشركة. احجزها بشريحة تانية، أو اربطها من إعدادات الشركة.",
    CARRIER_MANUAL_CANCEL_REQUIRED:
      "الشركة دي مش بتلغي الشحنات من هنا. الغي الشحنة من لوحة شركة الشحن الأول، وبعدين أكّد هنا.",
    CARRIER_CONNECT_CONFLICT:
      "الشركة دي اتربطت من تاب تاني أو زميل ربطها في نفس اللحظة، فالحفظ ده متمش. اعمل تحديث وشوف الربط، واحفظ تاني لو محتاج.",
    CARRIER_BOOKING_NOT_SAVED:
      "شركة الشحن عملت الشحنة بس مقدرناش نسجلها هنا. الغيها من لوحة الشركة واحجز الأوردر تاني.",
    SHIPPING_TIERS_REQUIRED: "ضيف شريحة وزن واحدة على الأقل قبل ما تسعّر الشحن بالوزن.",
    DEFAULT_ITEM_WEIGHT_REQUIRED: "حدد وزن افتراضي للمنتج الأول. لازم طول ما الشحن متسعّر بالوزن.",
    // handoff 184
    ADDRESS_LOOKUP_KEY_REQUIRED: "ضيف مفتاح Google API بتاعك عشان تستخدم اقتراحات خرائط جوجل.",
    ADDRESS_LOOKUP_INVALID_KEY:
      "جوجل رفضت المفتاح ده. اتأكد إنك نسخته كله، وإن Places API (New) متفعّل عليه في Google Cloud console بتاعك.",
    ADDRESS_LOOKUP_UNAVAILABLE: "مقدرناش نوصل لجوجل عشان نجرّب المفتاح. جرّب تاني بعد كام دقيقة.",
    GATEWAYS_NOT_CONFIGURED: "الدفع الأونلاين لسه مش متاح هنا. كلّم الدعم.",
    GATEWAY_AUTH_FAILED: "بوابة الدفع رفضت المفاتيح دي. انسخها تاني من لوحة البوابة واربط من جديد.",
    GATEWAY_KEYS_MODE_MISMATCH: "مفتاح منهم تجريبي والتاني حقيقي. استخدم الاتنين من نفس النوع.",
    GATEWAY_KEYS_UNRECOGNISED: "المفاتيح دي شكلها مش بتاعة البوابة دي. اتأكد إنك نسخت الصح.",
    GATEWAY_NOT_CONNECTED: "بوابة الدفع دي مبقتش مربوطة بمتجرك.",
    GATEWAY_HAS_PENDING_PAYMENTS: "فيه أوردرات لسه مستنية دفع عن طريق البوابة دي. استنى لحد ما تتدفع أو مهلتها تخلص، وبعدين الغي الربط.",
    GATEWAY_CREDENTIALS_UNREADABLE: "مفاتيح البوابة المتسجلة مبقتش بتتقري. اربط البوابة تاني.",
    PAYMENT_METHOD_UNAVAILABLE: "طريقة الدفع دي مش متاحة دلوقتي.",
    REFUND_EXCEEDS_ELIGIBLE_AMOUNT: "المبلغ ده أكبر من اللي فاضل ينفع يترجع في الأوردر.",
    REFUND_EXCEEDS_PAYMENT: "مفيش دفعة واحدة فاضل فيها المبلغ ده. رجّع كل دفعة لوحدها.",
    REFUND_PAYMENT_INVALID: "الدفعة دي مينفعش ترجع عن طريق البوابة.",
    ORDER_TEST_PAYMENT: "الأوردر ده اتدفع تجريبي، فمينفعش يتشحن.",
    PLAN_LIMIT_REACHED: "وصلت للحد بتاع باقتك. رقّي الباقة عشان تضيف أكتر.",
    STORE_NOT_SET_UP: "جهّز متجرك الأول (ضيف منتج) قبل ما تربط دومين.",
    DOMAIN_TAKEN: "الدومين ده مربوط بمتجر تاني.",
    DOMAIN_PRICE_CHANGED: "السعر اتغير — راجعه وأكّد تاني.",
    DOMAIN_UNAVAILABLE: "الدومين ده مبقاش متاح. دوّر على اسم تاني.",
    DOMAIN_PURCHASE_FAILED: "معرفناش نشتري الدومين، ومفيش أي فلوس اتخصمت. جرّب تاني بعد شوية.",
    DOMAIN_NOT_ACTIVE: "التجديد بيبقى للدومين اللي اشتريته وشغال أو خلصت مدته بس.",
    TRIAL_NOT_AVAILABLE: "الفترة المجانية مش متاحة للحساب ده.",
    EMAIL_DOMAIN_TAKEN: "متجر تاني بيبعت من الدومين ده.",
    draftRequired: "متجرك لسه مسودة. اشترك عشان تنشره.",
    limitFunnels: "وصلت لحد مسارات البيع في باقتك الشهر ده ({used} من {max}). تقدر تعمل تاني من {date}.",
    limitStores: "وصلت لأقصى عدد متاجر في باقتك ({used} من {max}). رقّي باقة متجر من متاجرك عشان تضيف واحد كمان.",
    limitDrafts: "اشترك في متجر من متاجرك الأول قبل ما تبدأ متجر جديد.",
    limitDomains: "وصلت لأقصى عدد دومينات في باقتك ({used} من {max}). رقّي الباقة عشان تضيف دومين تاني.",
    cancelFailedPermission:
      "شركة الشحن رفضت تلغي الشحنة لأن المفتاح المربوط مش بصلاحية Full Access. الأوردر متلغاش. اربط الشركة تاني بمفتاح Full Access من صفحة الشحن، أو الغي الشحنة من لوحة الشركة الأول.",
    cancelFailedAuth:
      "شركة الشحن رفضت المفتاح المتسجل، فالشحنة متلغتش والأوردر زي ما هو. اربط الشركة تاني من صفحة الشحن.",
    courierReply: "رد شركة الشحن: {message}",
    carrierPermissionNamed:
      "{name} قبلت الدخول، بس لسه مفعّلتش الربط (API) لحسابك. بياناتك صح: اطلب من {name} تفعّل الربط وجرّب تاني.",
    carrierPermissionBosta:
      "بوسطة رفضت العملية دي بالمفتاح المربوط. راجع صلاحية المفتاح في لوحة بوسطة، أو اربط بمفتاح صلاحيته Full Access.",
    carrierSandboxNamed:
      "ربط {name} ده على حساب تجريبي (Sandbox)، وده بيعمل شحنات تجريبية بس، فمفيش حاجة اتحجزت. محتاج حساب حقيقي (Production) عند {name}: اربطه من صفحة الشحن.",
    cancelFailedApiAccess:
      "{name} رفضت تلغي الشحنة لأنها لسه مفعّلتش الربط (API) لحسابك. الأوردر متلغاش. اطلب من {name} تفعّل الربط، أو الغي الشحنة من لوحة {name} الأول.",
  },
} satisfies Messages;

const OWN_KEY_LIST = [
  "network",
  "generic",
  "cancelFailedPermission",
  "cancelFailedAuth",
  "courierReply",
  "carrierPermissionNamed",
  "carrierPermissionBosta",
  "carrierSandboxNamed",
  "cancelFailedApiAccess",
  "draftRequired",
  "limitFunnels",
  "limitStores",
  "limitDrafts",
  "limitDomains",
] as const;
type CodeKey = Exclude<keyof typeof STRINGS.en, (typeof OWN_KEY_LIST)[number]>;
const OWN_KEYS: ReadonlySet<string> = new Set(OWN_KEY_LIST);

/** Bosta's CARRIER_PERMISSION_DENIED is its key's access level; every other courier's is API access on the account. */
const KEY_SCOPE_CARRIERS: ReadonlySet<string> = new Set(["bosta"]);

/** Codes whose server message is shown as-is, never replaced. */
const VERBATIM_CODES: ReadonlySet<string> = new Set<ApiErrorCode>(["CARRIER_ERROR", "GATEWAY_ERROR", "GATEWAY_REJECTED"]);

export type ErrorOverrides = Partial<Record<ApiErrorCode, string>>;

function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0 || err.message === "Failed to fetch";
  return err instanceof TypeError && /fetch/i.test(err.message);
}

/**
 * Returns `(err, overrides?) => message` in the active language.
 *
 * Order of precedence: a per-call override for the code, the shared
 * translation, the server's own message for verbatim/unknown codes, then a
 * generic sentence. A plain `Error` thrown by our own code (already
 * translated by whoever threw it) passes through unchanged.
 */
export function useErrorMessage() {
  const t = useT(STRINGS);
  return useCallback((err: unknown, overrides?: ErrorOverrides): string => translateError(t, err, overrides), [t]);
}

/**
 * The same sentence outside a component (event handlers in plain modules,
 * lib/errors.ts), in the language active right now.
 */
export function errorMessageNow(err: unknown, overrides?: ErrorOverrides): string {
  return translateError(STRINGS[getLocale()], err, overrides);
}

/** True when a sentence has no Arabic letters — the server's English, shown in the Arabic UI. */
const ARABIC_LETTER = /[؀-ۿ]/;

function translateError(t: (typeof STRINGS)["en"], err: unknown, overrides?: ErrorOverrides): string {
  if (isNetworkError(err)) return t.network;
  const code = apiErrorCode(err);
  if (code) {
    const override = overrides?.[code];
    if (override) return override;
    if (VERBATIM_CODES.has(code) && err instanceof ApiError && err.message) return err.message;
    // A draft store (not subscribed yet) is not an expired one.
    if (code === "SUBSCRIPTION_REQUIRED" && apiErrorDetails<{ draft?: boolean }>(err)?.draft) return t.draftRequired;
    if (code === "PLAN_LIMIT_REACHED") {
      const limit = apiErrorDetails<{ limit?: string; max?: number; allowed?: number; used?: number; resetsAt?: string }>(err);
      const counts = { max: limit?.max ?? limit?.allowed ?? "", used: limit?.used ?? "" };
      if (limit?.limit === "funnels_per_month") return fmt(t.limitFunnels, { ...counts, date: formatDate(limit.resetsAt ?? null) });
      if (limit?.limit === "stores") return fmt(t.limitStores, counts);
      if (limit?.limit === "draft_stores") return t.limitDrafts;
      if (limit?.limit === "domains") return fmt(t.limitDomains, counts);
    }
    if (code === "CARRIER_CANCEL_FAILED") {
      // Only order cancellation raises it. The courier-side cause decides
      // what the merchant can do next; the courier's own words come along
      // for anything we can't name.
      const details = apiErrorDetails<CarrierCancelFailedDetails>(err);
      const cause = details?.carrierErrorCode;
      if (cause === "CARRIER_PERMISSION_DENIED") {
        const carrierCode = details?.carrierCode;
        return carrierCode && !KEY_SCOPE_CARRIERS.has(carrierCode)
          ? fmt(t.cancelFailedApiAccess, { name: providerName(carrierCode) })
          : t.cancelFailedPermission;
      }
      if (cause === "CARRIER_AUTH_FAILED") return t.cancelFailedAuth;
      const reply = err instanceof ApiError ? err.message : "";
      return reply ? `${t.CARRIER_CANCEL_FAILED} ${fmt(t.courierReply, { message: reply })}` : t.CARRIER_CANCEL_FAILED;
    }
    if (code in t && !OWN_KEYS.has(code)) return t[code as CodeKey];
  }
  if (err instanceof ApiError) {
    if (err.status === 403) return t.FORBIDDEN;
    if (err.status === 401) return t.UNAUTHENTICATED;
    // An unknown code: the server's sentence beats saying nothing useful —
    // unless it is English inside the Arabic dashboard.
    if (!err.message) return t.generic;
    if (t === STRINGS.ar && !ARABIC_LETTER.test(err.message)) return t.generic;
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return t.generic;
}

/**
 * `useErrorMessage` for a call made with a known courier: the permission and
 * sandbox errors carry no courier name, so they are worded here with it.
 */
export function useCarrierErrorMessage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  return useCallback(
    (err: unknown, carrier: { code: string; name: string } | null | undefined, overrides?: ErrorOverrides): string => {
      if (!carrier) return errorMessage(err, overrides);
      const name = carrier.name || providerName(carrier.code);
      return errorMessage(err, {
        CARRIER_PERMISSION_DENIED: KEY_SCOPE_CARRIERS.has(carrier.code)
          ? t.carrierPermissionBosta
          : fmt(t.carrierPermissionNamed, { name }),
        CARRIER_SANDBOX_NOT_ALLOWED: fmt(t.carrierSandboxNamed, { name }),
        ...overrides,
      });
    },
    [t, errorMessage]
  );
}
