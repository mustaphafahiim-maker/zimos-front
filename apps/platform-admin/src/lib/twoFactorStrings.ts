import type { TwoFactorChallenge, TwoFactorMode } from "@store-builder/api-client";

/** Two-step sign-in in the console: the code step and support's reset, English and Arabic (MSA). */
export const TWO_FACTOR_STRINGS = {
  en: {
    newDevice: "You are signing in from a device we don't know yet.",
    newDeviceWait: "We already sent several codes, so no new one was sent. Wait a few minutes and sign in again.",
    codeNotSent: "We already sent several codes, so no new one was sent. Use a backup code, or wait a few minutes.",
    appBody: "Enter the 6-digit code from your authenticator app.",
    emailBody: "We sent a 6-digit code to {to}.",
    whatsappBody: "We sent a 6-digit code to {to} on WhatsApp.",
    smsBody: "We sent a 6-digit code to {to} by SMS.",
    you: "you",
    code: "Code",
    backupCode: "Backup code",
    useBackup: "Can't get the code? Use a backup code",
    useCode: "Use the sign-in code instead",
    verify: "Sign in",
    verifying: "Checking…",
    back: "Back to sign in",
    tooMany: "Too many wrong codes. Go back and sign in again.",
    wrong: "That code is not correct or has expired.",
    unreachable: "Can't reach the server. Try again.",
    // A person's page.
    rowLabel: "Two-step sign-in",
    off: "Off",
    email: "Email code",
    totp: "Authenticator app",
    whatsapp: "WhatsApp code",
    notReported: "Not reported",
    since: "since {date}",
    turnOff: "Turn off",
    resetTitle: "Turn off two-step sign-in?",
    resetBody:
      "Only for a person who lost every way through it, after you have checked who they are. They are signed out everywhere, remembered browsers are forgotten, and they get an email saying so.",
    resetDone: "Two-step sign-in is off. The person was emailed.",
  },
  ar: {
    newDevice: "أنت تسجّل الدخول من جهاز لا نعرفه بعد.",
    newDeviceWait: "أرسلنا عدة رموز من قبل، لذلك لم نرسل رمزًا جديدًا. انتظر بضع دقائق ثم سجّل الدخول مرة أخرى.",
    codeNotSent: "أرسلنا عدة رموز من قبل، لذلك لم نرسل رمزًا جديدًا. استخدم رمزًا احتياطيًا، أو انتظر بضع دقائق.",
    appBody: "أدخل الرمز المكوّن من ٦ أرقام من تطبيق المصادقة.",
    emailBody: "أرسلنا رمزًا من ٦ أرقام إلى {to}.",
    whatsappBody: "أرسلنا رمزًا من ٦ أرقام إلى {to} عبر واتساب.",
    smsBody: "أرسلنا رمزًا من ٦ أرقام إلى {to} في رسالة نصية.",
    you: "حسابك",
    code: "الرمز",
    backupCode: "رمز احتياطي",
    useBackup: "لم يصلك الرمز؟ استخدم رمزًا احتياطيًا",
    useCode: "استخدم رمز تسجيل الدخول بدلًا من ذلك",
    verify: "تسجيل الدخول",
    verifying: "جارٍ التحقق…",
    back: "العودة إلى تسجيل الدخول",
    tooMany: "رموز خاطئة كثيرة. عُد وسجّل الدخول مرة أخرى.",
    wrong: "الرمز غير صحيح أو انتهت صلاحيته.",
    unreachable: "تعذّر الوصول إلى الخادم. حاول مرة أخرى.",
    rowLabel: "تسجيل الدخول بخطوتين",
    off: "متوقف",
    email: "رمز بالبريد الإلكتروني",
    totp: "تطبيق المصادقة",
    whatsapp: "رمز عبر واتساب",
    notReported: "غير معروف",
    since: "منذ {date}",
    turnOff: "إيقاف",
    resetTitle: "إيقاف تسجيل الدخول بخطوتين؟",
    resetBody:
      "لمن فقد كل طرق تجاوز الخطوة الثانية فقط، وبعد التحقق من هويته. سيُسجَّل خروجه من كل الأجهزة، وتُنسى المتصفحات المحفوظة، وتصله رسالة بريد إلكتروني بذلك.",
    resetDone: "تم إيقاف تسجيل الدخول بخطوتين. أُرسلت رسالة إلى صاحب الحساب.",
  },
};

type Strings = (typeof TWO_FACTOR_STRINGS)["en"];

function fill(template: string, to: string): string {
  return template.replace("{to}", to);
}

/** The line over the code field: where the code went, or why none was sent. */
export function challengeBody(t: Strings, challenge: TwoFactorChallenge): string {
  if (challenge.codeNotSent) return challenge.newDevice ? t.newDeviceWait : t.codeNotSent;
  if (challenge.channel === "totp") return t.appBody;
  const to = challenge.sentTo ?? t.you;
  if (challenge.channel === "whatsapp") return fill(t.whatsappBody, to);
  if (challenge.channel === "sms") return fill(t.smsBody, to);
  return fill(t.emailBody, to);
}

/** A typed sign-in code is six digits; a backup code is eight letters or digits, dash or not. */
export function codeReady(code: string, backup: boolean): boolean {
  return backup ? code.replace(/[^A-Z0-9]/g, "").length === 8 : code.length === 6;
}

/** What is kept of what was typed: digits for a sign-in code, capitals, digits and the dash for a backup code. */
export function cleanCode(typed: string, backup: boolean): string {
  return backup ? typed.toUpperCase().replace(/[^A-Z0-9-]/g, "") : typed.replace(/\D/g, "");
}

/** The second step's name on a person's page; null mode = the API did not say. */
export function modeLabel(t: Strings, mode: TwoFactorMode | null): string {
  if (mode === null) return t.notReported;
  return { off: t.off, email: t.email, totp: t.totp, whatsapp: t.whatsapp }[mode] ?? mode;
}
