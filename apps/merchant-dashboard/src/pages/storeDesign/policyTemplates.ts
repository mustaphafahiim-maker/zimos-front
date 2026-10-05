import type { LegalPolicyKey } from "@store-builder/api-client";

/**
 * Starting points for the three legal policies, in Arabic and English. They
 * are a draft for the merchant to read and adapt, not legal advice. The
 * {{store.*}} variables are filled in by the server when a policy is shown.
 */
export const POLICY_TEMPLATES: Record<"ar" | "en", Record<LegalPolicyKey, string>> = {
  ar: {
    refund_policy: [
      "سياسة الاسترجاع والاستبدال — {{store.name}}",
      "يمكنك طلب استرجاع أو استبدال المنتج خلال 14 يومًا من تاريخ الاستلام.",
      "يشترط أن يكون المنتج في حالته الأصلية، غير مستخدم، وبكامل ملحقاته وعبوته.",
      "عند استلام الطلب يحق لك معاينة المنتج أمام المندوب ورفض استلامه إذا كان به عيب أو مخالفًا لما طلبته.",
      "إذا وصل المنتج تالفًا أو مختلفًا عن الطلب نتحمل نحن تكلفة الشحن في الاتجاهين. في غير ذلك يتحمل العميل تكلفة شحن الإرجاع.",
      "يُرد المبلغ بنفس وسيلة الدفع خلال 7 إلى 14 يوم عمل من استلامنا للمنتج المرتجع وفحصه.",
      "لطلب استرجاع أو استبدال تواصل معنا على {{store.phone}} أو {{store.email}}.",
    ].join("\n"),
    privacy_policy: [
      "سياسة الخصوصية — {{store.name}}",
      "نجمع البيانات التي تكتبها عند الطلب فقط: الاسم، رقم الهاتف، العنوان، والبريد الإلكتروني إن وُجد.",
      "نستخدم هذه البيانات لتأكيد الطلب وشحنه والتواصل معك بخصوصه، ولا نبيعها لأي طرف.",
      "نشارك الاسم والهاتف والعنوان مع شركة الشحن لتوصيل طلبك، ومع مزود الدفع عند الدفع الإلكتروني.",
      "يستخدم المتجر ملفات تعريف الارتباط وأدوات قياس الإعلانات لمعرفة أداء الحملات وتحسين المتجر.",
      "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها في أي وقت بمراسلتنا على {{store.email}}.",
      "عنواننا: {{store.address}}. الهاتف: {{store.phone}}.",
    ].join("\n"),
    terms_of_service: [
      "شروط الخدمة — {{store.name}}",
      "باستخدامك لهذا المتجر وتسجيل طلب فأنت توافق على هذه الشروط.",
      "الأسعار المعروضة هي بالعملة الظاهرة في المتجر، ويضاف إليها مصاريف الشحن التي تظهر قبل تأكيد الطلب.",
      "الطلب يُعتبر مؤكدًا بعد تواصلنا معك هاتفيًا أو عبر واتساب. يحق لنا إلغاء أي طلب لا نستطيع تأكيده.",
      "نحرص على دقة صور المنتجات ووصفها، وقد تختلف الألوان قليلًا باختلاف الشاشات.",
      "مواعيد التوصيل تقديرية وقد تتأثر بظروف شركة الشحن.",
      "الاسترجاع والاستبدال يخضعان لسياسة الاسترجاع المنشورة في المتجر.",
      "لأي استفسار تواصل معنا على {{store.phone}} أو {{store.email}}.",
    ].join("\n"),
  },
  en: {
    refund_policy: [
      "Refund and exchange policy — {{store.name}}",
      "You can ask to return or exchange a product within 14 days of receiving it.",
      "The product must be in its original condition, unused, with all its accessories and packaging.",
      "On delivery you may inspect the product in front of the courier and refuse it if it is defective or not what you ordered.",
      "If the product arrives damaged or different from your order, we pay shipping both ways. Otherwise the return shipping cost is the customer's.",
      "Refunds are made to the original payment method within 7 to 14 business days of our receiving and inspecting the returned product.",
      "To request a return or an exchange, contact us on {{store.phone}} or {{store.email}}.",
    ].join("\n"),
    privacy_policy: [
      "Privacy policy — {{store.name}}",
      "We only collect what you enter when ordering: name, phone number, address, and email if you give one.",
      "We use this information to confirm and ship your order and to contact you about it. We do not sell it to anyone.",
      "We share your name, phone and address with the courier to deliver your order, and with the payment provider when you pay online.",
      "The store uses cookies and ad measurement tools to understand campaign performance and improve the store.",
      "You can ask to see, correct or delete your data at any time by writing to {{store.email}}.",
      "Our address: {{store.address}}. Phone: {{store.phone}}.",
    ].join("\n"),
    terms_of_service: [
      "Terms of service — {{store.name}}",
      "By using this store and placing an order you agree to these terms.",
      "Prices are shown in the store's currency. Shipping fees are added and shown before you confirm the order.",
      "An order is confirmed once we reach you by phone or WhatsApp. We may cancel any order we cannot confirm.",
      "We take care that product photos and descriptions are accurate; colours may differ slightly between screens.",
      "Delivery times are estimates and may be affected by the courier.",
      "Returns and exchanges follow the refund policy published in the store.",
      "For any question, contact us on {{store.phone}} or {{store.email}}.",
    ].join("\n"),
  },
};
