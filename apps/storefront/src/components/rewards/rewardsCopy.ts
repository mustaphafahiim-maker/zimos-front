import type { Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * The shopper's words for what a signed-in customer gets: their own price
 * list, their VIP level, and inviting a friend.
 * Kept beside the components that say them, like the tenders' copy. Arabic is
 * Egyptian, as the rest of the store.
 */

const AR = new Intl.NumberFormat("ar-EG");
const EN = new Intl.NumberFormat("en-US");
const FR = new Intl.NumberFormat("fr-FR");

/** «قطعة واحدة / قطعتين / ٥ قطع / ١١ قطعة». */
function piecesAr(n: number): string {
  if (n === 1) return "قطعة واحدة";
  if (n === 2) return "قطعتين";
  const mod = n % 100;
  return `${AR.format(n)} ${mod >= 3 && mod <= 10 ? "قطع" : "قطعة"}`;
}
/** «طلب واحد / طلبين / ٣ طلبات / ١١ طلب». */
function ordersAr(n: number): string {
  if (n === 1) return "طلب واحد";
  if (n === 2) return "طلبين";
  const mod = n % 100;
  return `${AR.format(n)} ${mod >= 3 && mod <= 10 ? "طلبات" : "طلب"}`;
}
const piecesEn = (n: number) => (n === 1 ? "1 piece" : `${EN.format(n)} pieces`);
const ordersEn = (n: number) => (n === 1 ? "1 order" : `${EN.format(n)} orders`);
const piecesFr = (n: number) => (n <= 1 ? `${n} pièce` : `${FR.format(n)} pièces`);
const ordersFr = (n: number) => (n <= 1 ? `${n} commande` : `${FR.format(n)} commandes`);

const en = {
  // ---- price lists: product page and cart
  yourPrice: (price: string, base: string) => `Your price: ${price} instead of ${base}`,
  /** The shopper's list, beside their price ("Wholesale"). */
  listPrices: (name: string) => `${name} prices`,
  fromPieces: (n: number, price: string) => `From ${piecesEn(n)}: ${price}`,
  tiersTitle: "Your prices by quantity",
  tierNow: "your price now",
  cartYourPrice: "Your price",
  insteadOf: (base: string) => `instead of ${base}`,
  // ---- VIP: account
  vipTab: "My level",
  yourLevel: (name: string) => `Your level: ${name}`,
  noLevel: "You haven't reached a level yet",
  noLevelHint: "Your level goes up with your delivered orders.",
  perkPercent: (n: number) => `${EN.format(n)}% off your orders`,
  perkShipping: "Free shipping",
  perkPoints: (n: number) => `${EN.format(n)}× loyalty points`,
  nextSpent: (amount: string, name: string) => `${amount} more to ${name}`,
  nextOrders: (n: number, name: string) => `${n === 1 ? "1 more order" : `${EN.format(n)} more orders`} to ${name}`,
  progressTo: (name: string) => `Progress to ${name}`,
  topLevel: "You're at the highest level.",
  standingSpent: (amount: string) => `Your delivered orders so far: ${amount}`,
  standingOrders: (n: number) => `Delivered so far: ${ordersEn(n)}`,
  allLevels: "The store's levels",
  fromSpent: (amount: string) => `From ${amount}`,
  fromOrders: (n: number) => `From ${ordersEn(n)}`,
  yoursBadge: "Your level",
  noPerks: "No perks set for this level yet",
  vipHow: "You get your level's perks when you order while signed in.",
  vipOff: "This store has no VIP levels right now.",
  // ---- checkout
  vipLine: (n: number) => `VIP ${EN.format(n)}% off`,
  vipLevel: (name: string) => `Your level: ${name}`,
  vipShipping: "Free shipping for VIP",
  shippingComesOff: "The shipping fee above comes off your order.",
  atOrder: "Taken off the products' prices when you place the order: you'll see the final total right after.",
  biggestWins: "With more than one discount on a product, the store applies the bigger one.",
  inviteApplied: (offer: string) => `Invite applied: ${offer}`,
  inviteOfferPercent: (n: number) => `${EN.format(n)}% off your first order`,
  inviteOfferShipping: "free shipping on your first order",
  inviteOfferBoth: (n: number) => `${EN.format(n)}% off and free shipping on your first order`,
  removeInvite: "Remove the invite",
  refusedInvalid: "This invite code is not valid",
  refusedOwn: "You can't use your own invite",
  refusedNotFirst: "Invites are for a first order in this store",
  refusedOff: "This store has no invite program",
  refusedHint: "You can still place your order without the invite.",
  placeWithout: "Place the order without the invite",
  // ---- landing banner
  bannerPercent: (n: number) => `You've been invited! ${EN.format(n)}% off your first order`,
  bannerShipping: "You've been invited! Free shipping on your first order",
  bannerBoth: (n: number) => `You've been invited! ${EN.format(n)}% off and free shipping on your first order`,
  bannerLabel: "Your invite",
  bannerClose: "Hide this",
  // ---- invites: account
  inviteTab: "Invite friends",
  inviteTitle: "Invite friends",
  offerCredit: (friend: string, amount: string) => `Your friend gets ${friend}; you get ${amount} credit once it's delivered`,
  offerPoints: (friend: string, points: string) => `Your friend gets ${friend}; you get ${points} once it's delivered`,
  friendPercent: (n: number) => `${EN.format(n)}% off their first order`,
  friendShipping: "free shipping on their first order",
  friendBoth: (n: number) => `${EN.format(n)}% off and free shipping on their first order`,
  minOrder: (amount: string) => `The reward counts when your friend's order is ${amount} or more.`,
  yourLink: "Your invite link",
  yourCode: "Your code",
  copyLink: "Copy link",
  copied: "Copied",
  copyFailed: "Couldn't copy. Select the link and copy it.",
  shareWhatsapp: "Share on WhatsApp",
  shareText: (offer: string, store: string, url: string) => `I'm inviting you to ${store}: ${offer}. ${url}`,
  shareOfferPercent: (n: number) => `${EN.format(n)}% off your first order`,
  shareOfferShipping: "free shipping on your first order",
  shareOfferBoth: (n: number) => `${EN.format(n)}% off and free shipping on your first order`,
  statPending: "Waiting for delivery",
  statRewarded: "Rewarded",
  invitesTitle: "Your invites",
  invitesEmpty: "Nobody has ordered with your invite yet",
  invitesEmptyHint: "Share your link. You're rewarded once a friend's first order is delivered.",
  statusPending: "Waiting for delivery",
  statusRewarded: "Rewarded",
  statusVoid: "Cancelled",
  friendOrder: "A friend's order",
  youGotCredit: (amount: string) => `You got ${amount} credit`,
  youGotPoints: (points: string) => `You got ${points}`,
  inviteOff: "This store has no invite programme right now.",
  orders: ordersEn,
  pieces: piecesEn,
};

export type RewardsCopy = typeof en;

const ar: RewardsCopy = {
  yourPrice: (price, base) => `سعرك: ${price} بدل ${base}`,
  listPrices: (name) => `أسعار ${name}`,
  fromPieces: (n, price) => `من ${piecesAr(n)}: ${price}`,
  tiersTitle: "أسعارك حسب الكمية",
  tierNow: "سعرك دلوقتي",
  cartYourPrice: "سعرك",
  insteadOf: (base) => `بدل ${base}`,
  vipTab: "مستواي",
  yourLevel: (name) => `مستواك: ${name}`,
  noLevel: "لسه ما وصلتش لأي مستوى",
  noLevelHint: "مستواك بيعلى مع طلباتك اللي بتتسلّم.",
  perkPercent: (n) => `خصم ${AR.format(n)}٪ على طلباتك`,
  perkShipping: "شحن مجاني",
  perkPoints: (n) => `نقط ولاء ×${AR.format(n)}`,
  nextSpent: (amount, name) => `فاضل ${amount} لـ ${name}`,
  nextOrders: (n, name) => `فاضل ${ordersAr(n)} لـ ${name}`,
  progressTo: (name) => `التقدّم لـ ${name}`,
  topLevel: "إنت في أعلى مستوى.",
  standingSpent: (amount) => `طلباتك اللي اتسلّمت لحد دلوقتي: ${amount}`,
  standingOrders: (n) => `اللي اتسلّم لحد دلوقتي: ${ordersAr(n)}`,
  allLevels: "مستويات المتجر",
  fromSpent: (amount) => `من ${amount}`,
  fromOrders: (n) => `من ${ordersAr(n)}`,
  yoursBadge: "مستواك",
  noPerks: "لسه مفيش مميزات للمستوى ده",
  vipHow: "بتاخد مميزات مستواك لما تطلب وانت مسجّل دخول.",
  vipOff: "المتجر مفيهوش مستويات VIP دلوقتي.",
  vipLine: (n) => `خصم VIP ${AR.format(n)}٪`,
  vipLevel: (name) => `مستواك: ${name}`,
  vipShipping: "شحن مجاني لعملاء VIP",
  shippingComesOff: "مصاريف الشحن اللي فوق هتتشال من طلبك.",
  atOrder: "بيتخصم من سعر المنتجات لما تأكّد الطلب: الإجمالي النهائي هيظهرلك بعدها على طول.",
  biggestWins: "لو المنتج عليه أكتر من خصم، المتجر بيحسب الأكبر.",
  inviteApplied: (offer) => `الدعوة متطبّقة: ${offer}`,
  inviteOfferPercent: (n) => `خصم ${AR.format(n)}٪ على أول طلب`,
  inviteOfferShipping: "شحن مجاني على أول طلب",
  inviteOfferBoth: (n) => `خصم ${AR.format(n)}٪ وشحن مجاني على أول طلب`,
  removeInvite: "شيل الدعوة",
  refusedInvalid: "كود الدعوة مش صحيح",
  refusedOwn: "مينفعش تستخدم دعوتك لنفسك",
  refusedNotFirst: "الدعوة لأول طلب بس في المتجر",
  refusedOff: "المتجر مفيهوش برنامج دعوات",
  refusedHint: "تقدر تكمّل طلبك من غير الدعوة.",
  placeWithout: "كمّل الطلب من غير الدعوة",
  bannerPercent: (n) => `معاك دعوة! خصم ${AR.format(n)}٪ على أول طلب`,
  bannerShipping: "معاك دعوة! شحن مجاني على أول طلب",
  bannerBoth: (n) => `معاك دعوة! خصم ${AR.format(n)}٪ وشحن مجاني على أول طلب`,
  bannerLabel: "دعوتك",
  bannerClose: "اخفي ده",
  inviteTab: "ادعي صحابك",
  inviteTitle: "ادعي صحابك",
  offerCredit: (friend, amount) => `صاحبك ياخد ${friend}، وانت تاخد ${amount} رصيد لما يوصله`,
  offerPoints: (friend, points) => `صاحبك ياخد ${friend}، وانت تاخد ${points} لما يوصله`,
  friendPercent: (n) => `خصم ${AR.format(n)}٪ على أول طلب`,
  friendShipping: "شحن مجاني على أول طلب",
  friendBoth: (n) => `خصم ${AR.format(n)}٪ وشحن مجاني على أول طلب`,
  minOrder: (amount) => `المكافأة بتتحسب لما طلب صاحبك يبقى ${amount} أو أكتر.`,
  yourLink: "لينك دعوتك",
  yourCode: "كودك",
  copyLink: "انسخ اللينك",
  copied: "اتنسخ",
  copyFailed: "معرفناش ننسخ. علّم على اللينك وانسخه.",
  shareWhatsapp: "شارك على واتساب",
  shareText: (offer, store, url) => `بدعيك تشتري من ${store}: ${offer}. ${url}`,
  shareOfferPercent: (n) => `خصم ${AR.format(n)}٪ على أول طلب`,
  shareOfferShipping: "شحن مجاني على أول طلب",
  shareOfferBoth: (n) => `خصم ${AR.format(n)}٪ وشحن مجاني على أول طلب`,
  statPending: "مستنيين التوصيل",
  statRewarded: "اتكافئت عليهم",
  invitesTitle: "دعواتك",
  invitesEmpty: "لسه محدش طلب بدعوتك",
  invitesEmptyHint: "شارك اللينك بتاعك. بتتكافئ أول ما أول طلب لصاحبك يتسلّم.",
  statusPending: "مستني التوصيل",
  statusRewarded: "اتكافئ",
  statusVoid: "اتلغى",
  friendOrder: "طلب صاحبك",
  youGotCredit: (amount) => `أخدت ${amount} رصيد`,
  youGotPoints: (points) => `أخدت ${points}`,
  inviteOff: "المتجر مفيهوش برنامج دعوات دلوقتي.",
  orders: ordersAr,
  pieces: piecesAr,
};

const fr: RewardsCopy = {
  yourPrice: (price, base) => `Votre prix : ${price} au lieu de ${base}`,
  listPrices: (name) => `Tarifs ${name}`,
  fromPieces: (n, price) => `À partir de ${piecesFr(n)} : ${price}`,
  tiersTitle: "Vos prix selon la quantité",
  tierNow: "votre prix actuel",
  cartYourPrice: "Votre prix",
  insteadOf: (base) => `au lieu de ${base}`,
  vipTab: "Mon niveau",
  yourLevel: (name) => `Votre niveau : ${name}`,
  noLevel: "Vous n'avez pas encore atteint de niveau",
  noLevelHint: "Votre niveau monte avec vos commandes livrées.",
  perkPercent: (n) => `${FR.format(n)} % de réduction sur vos commandes`,
  perkShipping: "Livraison gratuite",
  perkPoints: (n) => `Points de fidélité ×${FR.format(n)}`,
  nextSpent: (amount, name) => `Encore ${amount} pour ${name}`,
  nextOrders: (n, name) => `Encore ${ordersFr(n)} pour ${name}`,
  progressTo: (name) => `Progression vers ${name}`,
  topLevel: "Vous êtes au niveau le plus élevé.",
  standingSpent: (amount) => `Vos commandes livrées à ce jour : ${amount}`,
  standingOrders: (n) => `Livré à ce jour : ${ordersFr(n)}`,
  allLevels: "Les niveaux de la boutique",
  fromSpent: (amount) => `À partir de ${amount}`,
  fromOrders: (n) => `À partir de ${ordersFr(n)}`,
  yoursBadge: "Votre niveau",
  noPerks: "Pas encore d'avantage pour ce niveau",
  vipHow: "Vous profitez des avantages de votre niveau en commandant connecté.",
  vipOff: "Cette boutique n'a pas de niveaux VIP pour le moment.",
  vipLine: (n) => `Réduction VIP ${FR.format(n)} %`,
  vipLevel: (name) => `Votre niveau : ${name}`,
  vipShipping: "Livraison gratuite pour les VIP",
  shippingComesOff: "Les frais de livraison ci-dessus seront retirés de votre commande.",
  atOrder: "Déduit du prix des produits à la validation de la commande : le total final s'affiche juste après.",
  biggestWins: "Avec plusieurs réductions sur un produit, la boutique applique la plus forte.",
  inviteApplied: (offer) => `Invitation appliquée : ${offer}`,
  inviteOfferPercent: (n) => `${FR.format(n)} % de réduction sur votre première commande`,
  inviteOfferShipping: "livraison gratuite sur votre première commande",
  inviteOfferBoth: (n) => `${FR.format(n)} % de réduction et livraison gratuite sur votre première commande`,
  removeInvite: "Retirer l'invitation",
  refusedInvalid: "Ce code d'invitation n'est pas valide",
  refusedOwn: "Vous ne pouvez pas utiliser votre propre invitation",
  refusedNotFirst: "Les invitations valent pour une première commande dans cette boutique",
  refusedOff: "Cette boutique n'a pas de programme d'invitation",
  refusedHint: "Vous pouvez tout de même commander sans l'invitation.",
  placeWithout: "Commander sans l'invitation",
  bannerPercent: (n) => `Vous êtes invité ! ${FR.format(n)} % de réduction sur votre première commande`,
  bannerShipping: "Vous êtes invité ! Livraison gratuite sur votre première commande",
  bannerBoth: (n) => `Vous êtes invité ! ${FR.format(n)} % de réduction et livraison gratuite sur votre première commande`,
  bannerLabel: "Votre invitation",
  bannerClose: "Masquer",
  inviteTab: "Inviter des amis",
  inviteTitle: "Inviter des amis",
  offerCredit: (friend, amount) => `Votre ami reçoit ${friend} ; vous recevez ${amount} d'avoir une fois la commande livrée`,
  offerPoints: (friend, points) => `Votre ami reçoit ${friend} ; vous recevez ${points} une fois la commande livrée`,
  friendPercent: (n) => `${FR.format(n)} % de réduction sur sa première commande`,
  friendShipping: "la livraison gratuite sur sa première commande",
  friendBoth: (n) => `${FR.format(n)} % de réduction et la livraison gratuite sur sa première commande`,
  minOrder: (amount) => `La récompense compte quand la commande de votre ami atteint ${amount}.`,
  yourLink: "Votre lien d'invitation",
  yourCode: "Votre code",
  copyLink: "Copier le lien",
  copied: "Copié",
  copyFailed: "Copie impossible. Sélectionnez le lien et copiez-le.",
  shareWhatsapp: "Partager sur WhatsApp",
  shareText: (offer, store, url) => `Je vous invite chez ${store} : ${offer}. ${url}`,
  shareOfferPercent: (n) => `${FR.format(n)} % de réduction sur votre première commande`,
  shareOfferShipping: "livraison gratuite sur votre première commande",
  shareOfferBoth: (n) => `${FR.format(n)} % de réduction et livraison gratuite sur votre première commande`,
  statPending: "En attente de livraison",
  statRewarded: "Récompensées",
  invitesTitle: "Vos invitations",
  invitesEmpty: "Personne n'a encore commandé avec votre invitation",
  invitesEmptyHint: "Partagez votre lien. Vous êtes récompensé dès que la première commande d'un ami est livrée.",
  statusPending: "En attente de livraison",
  statusRewarded: "Récompensée",
  statusVoid: "Annulée",
  friendOrder: "Commande d'un ami",
  youGotCredit: (amount) => `Vous avez reçu ${amount} d'avoir`,
  youGotPoints: (points) => `Vous avez reçu ${points}`,
  inviteOff: "Cette boutique n'a pas de programme d'invitation pour le moment.",
  orders: ordersFr,
  pieces: piecesFr,
};

const COPY: Record<Locale, RewardsCopy> = { en, ar, fr };

export function rewardsCopy(locale: Locale): RewardsCopy {
  return COPY[locale] ?? en;
}

/** The copy in the page's language. */
export function useRewardsCopy(): RewardsCopy {
  return rewardsCopy(useStore().locale);
}
