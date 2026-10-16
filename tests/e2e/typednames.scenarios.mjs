// J&T without its location list: the courier card's notes (read from
// GET /carriers), and booking with typed address names — asked for by a 422
// CARRIER_ADDRESS_NAMES_REQUIRED, or shown straight away for a connection
// marked `locationList: "unavailable"` — with 422 CARRIER_ADDRESS_REJECTED
// on one level or on the whole address. Registered in carriers.e2e.mjs.

import { JTEXPRESS, ORDER, WS, apiError, ok, order, shipment } from "./support/fixtures.mjs";
import { assertClean, bodiesOf, check, openPage, settle } from "./support/harness.mjs";

const carriersPath = `/workspaces/${WS}/carriers`;
const orderPath = `/workspaces/${WS}/orders/${ORDER}`;
const LEVELS = ["governorate", "city", "area"];

const cardOf = (page, name) =>
  page.getByRole("heading", { name, exact: true }).locator(
    "xpath=ancestor::div[contains(concat(' ', @class, ' '), ' p-4 ')][1]"
  );

const STR = {
  en: {
    book: "Book with J&T Express",
    labels: ["Governorate", "City", "Area"],
    title: "Type the delivery address as J&T Express writes it",
    chooseArea: "Choose the delivery area myself",
    required: (level) => `Enter the ${level}.`,
    rejected: (level) => `J&T Express doesn't recognise this ${level}. Use J&T Express's own spelling.`,
    whole: "J&T Express doesn't recognise this governorate, city and area together.",
    pickup: "check the pickup address in the J&T Express settings",
    typed: "Address typed for J&T Express:",
    unverifiedTitle: "Customer code and password not checked yet",
    listTitle: "Addresses are typed by hand",
    listNote:
      "J&T Express hasn't enabled the location list for this account, so the governorate, city and area are typed by hand when booking. The pickup address was saved without being checked against J&T Express's names.",
  },
  ar: {
    book: "احجز مع J&T Express",
    labels: ["المحافظة", "المدينة", "الحي"],
    title: "اكتب عنوان التوصيل كما تكتبه J&T Express",
    chooseArea: "اختيار منطقة التوصيل بنفسي",
    required: (level) => `اكتب ${level}.`,
    rejected: (level) => `لم تتعرّف J&T Express على ما كتبته في خانة ${level}. اكتبه كما تكتبه J&T Express.`,
    whole: "لم تتعرّف J&T Express على المحافظة والمدينة والحي معًا.",
    pickup: "راجع عنوان الاستلام في إعدادات J&T Express",
    typed: "العنوان المكتوب لـ J&T Express:",
    unverifiedTitle: "لم يتم التحقق من كود العميل وكلمة المرور بعد",
    listTitle: "العناوين تُكتب يدويًا",
    listNote:
      "لم تفعّل J&T Express قائمة المواقع لهذا الحساب، لذلك تُكتب المحافظة والمدينة والمنطقة يدويًا عند الحجز. وحُفظ عنوان الاستلام دون مراجعته على أسماء J&T Express.",
  },
};

const namesRequired = () =>
  apiError(422, "CARRIER_ADDRESS_NAMES_REQUIRED", "J&T Express does not let this account read its address list.", [
    { field: "carrierAddress.names", message: "Needs 3 names, one per level (governorate > city > area)", levels: LEVELS },
  ]);

/** J&T's refusal of one level (0-2), or of the whole address (null). */
const rejected = (index) =>
  apiError(422, "CARRIER_ADDRESS_REJECTED", "J&T Express does not recognise it. Use J&T's own spelling.", [
    {
      field: index === null ? "carrierAddress.names" : `carrierAddress.names.${index}`,
      message: "Not accepted by J&T Express",
      level: index === null ? null : LEVELS[index],
      carrierErrorCode: index === null ? "145003065" : ["145003062", "145003061", "145003060"][index],
    },
  ]);

const bookedShipment = (names) =>
  shipment({
    carrierCode: "jtexpress",
    waybillNumber: "JT-900",
    carrierResponse: { carrierShipmentId: "ZG-JT-1", address: { names } },
  });

/**
 * The order page with J&T connected (`verification` on its connection), and
 * POST /shipments answered by `answers` in turn; a missing answer books it.
 */
async function openBooking(browser, base, { locale, verification, answers }) {
  let booked = null;
  let posts = 0;
  const session = await openPage(browser, base, {
    locale,
    handler: (method, path, body) => {
      if (path === carriersPath) {
        return ok({ configured: true, carriers: [JTEXPRESS(true, verification ? { verification } : {})] });
      }
      if (path === orderPath) return ok({ order: order({ shipments: booked ? [booked] : [] }) });
      if (method === "POST" && path === `${orderPath}/shipments`) {
        const answer = answers[posts++];
        if (answer) return answer;
        booked = bookedShipment(body?.carrierAddress?.names ?? []);
        return ok({ shipment: booked }, 201);
      }
      return undefined;
    },
  });
  await session.page.goto(`${base}/orders/${ORDER}`);
  await settle(session.page);
  return session;
}

const input = (page, label) => page.getByLabel(label, { exact: true });
/** The Field wrapper (label, input, error) around an input. */
const fieldOf = (page, label) => input(page, label).locator("xpath=ancestor::div[1]");
const namesPosted = (requests) => bodiesOf(requests, "POST", "/shipments").map((b) => b?.carrierAddress?.names);

export async function namesRequiredThenResend(browser, base, locale = "en") {
  const label = `R${locale === "ar" ? "2" : ""}`;
  console.log(`\n${label}. Booking (${locale}): 422 CARRIER_ADDRESS_NAMES_REQUIRED shows three prefilled inputs, resent with carrierAddress.names`);
  const L = STR[locale];
  const session = await openBooking(browser, base, { locale, verification: null, answers: [namesRequired(), rejected(1)] });
  const { page, requests } = session;
  const [gov, city, area] = L.labels;

  check((await page.getByText(L.title).count()) === 0, "not marked: no typed inputs before the first try");
  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  check(await page.getByText(L.title).isVisible(), "names required: the typed-address box appears");
  check((await page.getByText(L.chooseArea).count()) === 0, "names required: no list picker offered");
  check((await input(page, gov).inputValue()) === "Cairo", "governorate prefilled from the order's province");
  check((await input(page, city).inputValue()) === "Nasr 7", "city prefilled from the order's city");
  check((await input(page, area).inputValue()) === "", "area left for the merchant");

  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  check(await fieldOf(page, area).getByText(L.required(area.toLowerCase())).isVisible(), "empty area: required on its field");
  check(namesPosted(requests).length === 1, "empty area: nothing sent");

  await input(page, area).fill("Nasr City 1");
  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  check(
    JSON.stringify(namesPosted(requests)[1]) === JSON.stringify(["Cairo", "Nasr 7", "Nasr City 1"]),
    `resent with carrierAddress.names (${JSON.stringify(namesPosted(requests)[1])})`
  );
  check(await fieldOf(page, city).getByText(L.rejected(city.toLowerCase()), { exact: false }).isVisible(), "city rejected: message on the city field");

  await input(page, city).fill("Nasr City");
  check((await fieldOf(page, city).getByText(L.rejected(city.toLowerCase()), { exact: false }).count()) === 0, "editing the city clears its error");
  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  check(
    JSON.stringify(namesPosted(requests)[2]) === JSON.stringify(["Cairo", "Nasr City", "Nasr City 1"]),
    "booked with the fixed city and the other values kept"
  );
  const typedLine = page.getByText(L.typed).locator("xpath=..");
  check(await typedLine.isVisible(), "shipment details: typed address shown");
  check(await typedLine.getByText("Nasr City 1").isVisible(), "shipment details: the typed area");
  check(await typedLine.getByText(`${gov}:`, { exact: false }).isVisible(), "shipment details: level labels");
  await assertClean(session, label);
  return session;
}

export async function markedTypesEachLevel(browser, base) {
  console.log("\nS. Booking: a connection marked locationList unavailable shows the inputs at once; each level rejected, then the whole address");
  const L = STR.en;
  const session = await openBooking(browser, base, {
    locale: "en",
    verification: { locationList: "unavailable" },
    answers: [rejected(0), rejected(1), rejected(2), rejected(null)],
  });
  const { page, requests } = session;
  const [gov, city, area] = L.labels;

  check(await page.getByText(L.title).isVisible(), "marked: typed inputs shown before any try");
  check((await page.getByText(L.chooseArea).count()) === 0, "marked: no list picker offered");
  check(namesPosted(requests).length === 0, "marked: no failed first attempt");
  await input(page, area).fill("Nasr City 1");

  const values = { [gov]: "Cairo", [city]: "Nasr 7", [area]: "Nasr City 1" };
  for (const [i, level] of [gov, city, area].entries()) {
    const sent = [values[gov], values[city], values[area]];
    await page.getByRole("button", { name: L.book }).click();
    await settle(page);
    check(JSON.stringify(namesPosted(requests)[i]) === JSON.stringify(sent), `try ${i + 1} sent the names as typed`);
    const own = fieldOf(page, level).getByText(L.rejected(level.toLowerCase()), { exact: false });
    check(await own.isVisible(), `${level.toLowerCase()} rejected: message on its field`);
    check(await fieldOf(page, level).getByText(L.pickup, { exact: false }).isVisible(), `${level.toLowerCase()} rejected: pickup-address hint`);
    for (const other of [gov, city, area].filter((l) => l !== level)) {
      check((await fieldOf(page, other).getByText(L.rejected(other.toLowerCase()), { exact: false }).count()) === 0, `${level.toLowerCase()} rejected: no error on ${other.toLowerCase()}`);
      check((await input(page, other).inputValue()) === values[other], `${level.toLowerCase()} rejected: ${other.toLowerCase()} kept`);
    }
    values[level] = `${values[level]} fixed`;
    await input(page, level).fill(values[level]);
  }

  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  const whole = page.getByRole("alert").filter({ hasText: L.whole });
  check(await whole.isVisible(), "whole address rejected: one alert over the three fields");
  check(await whole.getByText(L.pickup, { exact: false }).isVisible(), "whole address rejected: pickup-address hint");
  for (const level of [gov, city, area]) {
    check((await input(page, level).inputValue()) === values[level], `whole address rejected: ${level.toLowerCase()} kept`);
  }

  await page.getByRole("button", { name: L.book }).click();
  await settle(page);
  check(
    JSON.stringify(namesPosted(requests)[4]) === JSON.stringify([values[gov], values[city], values[area]]),
    "final try sends all three corrected names"
  );
  check(await page.getByText(L.typed).isVisible(), "booked: typed address on the shipment");
  await assertClean(session, "S");
  return session;
}

export async function cardShowsBothNotes(browser, base, locale = "en") {
  const label = `Q${locale === "ar" ? "2" : ""}`;
  console.log(`\n${label}. Courier card (${locale}): customerCredentials + locationList notes from GET /carriers, kept on reload`);
  const L = STR[locale];
  const session = await openPage(browser, base, {
    locale,
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) {
        return ok({
          configured: true,
          carriers: [JTEXPRESS(true, { verification: { customerCredentials: "unverified", locationList: "unavailable" } })],
        });
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/shipping`);
  await settle(page);
  const jt = cardOf(page, "J&T Express");
  for (const pass of ["load", "reload"]) {
    if (pass === "reload") {
      await page.reload();
      await settle(page);
    }
    check(await jt.getByRole("status").filter({ hasText: L.unverifiedTitle }).isVisible(), `${pass}: customer credentials note`);
    const list = jt.getByRole("status").filter({ hasText: L.listTitle });
    check(await list.isVisible(), `${pass}: location list note`);
    check(await list.getByText(L.listNote).isVisible(), `${pass}: location list note wording`);
  }
  await assertClean(session, label);
  return session;
}
