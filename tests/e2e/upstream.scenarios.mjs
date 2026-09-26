// Upstream courier failures (CARRIER_ERROR, CARRIER_BOOKING_NOT_SAVED) are
// matched by code: the backend is moving them from 502 to 424, and both must
// show the server's message, never the "can't reach the server" one. Plus
// J&T's `verification.customerCredentials: "unverified"` note on connect.
// Registered in carriers.e2e.mjs.

import { BOSTA, FAKEPOLL, JTEXPRESS, MYLERZ, ORDER, WS, apiError, ok, order } from "./support/fixtures.mjs";
import { assertClean, check, openPage, settle } from "./support/harness.mjs";

const carriersPath = `/workspaces/${WS}/carriers`;
const orderPath = `/workspaces/${WS}/orders/${ORDER}`;

const NETWORK = { en: "Can't reach the server", ar: "تعذّر الوصول إلى الخادم" };

const cardOf = (page, name) =>
  page.getByRole("heading", { name, exact: true }).locator(
    "xpath=ancestor::div[contains(concat(' ', @class, ' '), ' p-4 ')][1]"
  );

const connectResult = (carrier, verification) => ({
  carrier,
  webhook: { url: "https://api.example.test/hook", setup: "none", manualSetupRequired: false },
  verification,
});

export async function upstreamBookingErrors(browser, base, status) {
  console.log(`\nO${status === 502 ? "2" : ""}. Booking: ${status} CARRIER_BOOKING_NOT_SAVED and ${status} CARRIER_ERROR show the server's message`);
  const carrierMessage = "Bosta didn't confirm the booking in time. Check your Bosta dashboard before booking again.";
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (path === carriersPath) return ok({ configured: true, carriers: [BOSTA(true), FAKEPOLL(true)] });
      if (path === orderPath) return ok({ order: order() });
      if (method === "POST" && path === `${orderPath}/shipments`) {
        if (body?.carrierCode === "fakepoll") {
          return apiError(status, "CARRIER_BOOKING_NOT_SAVED", "FakePoll created shipment FP-77, but it could not be saved here.", {
            carrierCode: "fakepoll",
            trackingNumber: "FP-77",
            manualCancelRequired: true,
          });
        }
        return apiError(status, "CARRIER_ERROR", carrierMessage);
      }
      return undefined;
    },
  });
  const { page } = session;
  await page.goto(`${base}/orders/${ORDER}`);
  await settle(page);

  await page.getByRole("radio", { name: /^FakePoll/ }).check();
  await page.getByRole("button", { name: "Book with FakePoll" }).click();
  await settle(page);
  check(await page.getByText(/^Cancel .*FP-77.* in your FakePoll dashboard$/).isVisible(), `${status} BOOKING_NOT_SAVED: cancel-it box with the tracking number`);

  await page.getByRole("radio", { name: /^Bosta/ }).check();
  await page.getByRole("button", { name: "Book with Bosta" }).click();
  await settle(page);
  check(await page.getByText(carrierMessage).isVisible(), `${status} CARRIER_ERROR: the server's message, verbatim`);
  check(await page.getByText("Reload this page to book again, after you've checked.").isVisible(), `${status} CARRIER_ERROR: booking marked uncertain`);
  check((await page.getByRole("button", { name: "Book with Bosta" }).count()) === 0, `${status} CARRIER_ERROR: no immediate re-book`);
  check((await page.getByText(NETWORK.en, { exact: false }).count()) === 0, `${status}: never "Can't reach the server"`);
  await assertClean(session, `O${status === 502 ? "2" : ""}`);
  return session;
}

export async function connectUpstreamAndUnverified(browser, base, locale = "en") {
  const ar = locale === "ar";
  const label = `P${ar ? "2" : ""}`;
  console.log(`\n${label}. Connect (${locale}): 424 CARRIER_ERROR shows the message; J&T customer credentials unverified note`);
  const upstream = "J&T Express didn't respond. Try again in a few minutes.";
  let jtPuts = 0;
  let jtConnected = false;
  let mylerzConnected = false;
  const session = await openPage(browser, base, {
    locale,
    handler: (method, path) => {
      if (method === "GET" && path === carriersPath) {
        return ok({ configured: true, carriers: [JTEXPRESS(jtConnected), MYLERZ(mylerzConnected)] });
      }
      if (method === "PUT" && path === `${carriersPath}/jtexpress`) {
        jtPuts++;
        if (jtPuts === 1) return apiError(424, "CARRIER_ERROR", upstream);
        jtConnected = true;
        // 2nd: the account can't call the credential check. 3rd (key replaced): checked.
        return ok(connectResult(JTEXPRESS(true), jtPuts === 2 ? { customerCredentials: "unverified" } : {}));
      }
      if (method === "PUT" && path === `${carriersPath}/mylerz`) {
        mylerzConnected = true;
        return ok(connectResult(MYLERZ(true), {}));
      }
      return undefined;
    },
  });
  const { page } = session;
  const L = ar
    ? {
        connectJt: "ربط J&T Express",
        connectMylerz: "ربط Mylerz",
        verify: "تحقق من المفتاح وتابع",
        replace: "تغيير مفتاح API",
        title: "لم يتم التحقق من كود العميل وكلمة المرور بعد",
        note: "تم حفظ ربط J&T Express، لكن J&T Express لم تسمح لنا بالتحقق من كود العميل وكلمة المرور بعد. سيتم التحقق منهما عند حجز أول شحنة",
      }
    : {
        connectJt: "Connect J&T Express",
        connectMylerz: "Connect Mylerz",
        verify: "Check key and continue",
        replace: "Replace API key",
        title: "Customer code and password not checked yet",
        note: "The J&T Express connection is saved, but J&T Express didn't let us check the customer code and password yet. They'll be checked on your first booking",
      };
  await page.goto(`${base}/shipping`);
  await settle(page);

  const jt = cardOf(page, "J&T Express");
  const fillJt = async () => {
    await jt.getByLabel("API account").fill("acc");
    await jt.getByLabel("Private key").fill("pk");
    await jt.getByLabel("Customer code").fill("cc");
    await jt.getByLabel("Customer password").fill("pw");
  };
  await jt.getByRole("button", { name: L.connectJt }).click();
  await fillJt();
  await jt.getByRole("button", { name: L.verify }).click();
  await settle(page);
  check(await jt.getByText(upstream).isVisible(), "424 CARRIER_ERROR on connect: the server's message");
  check((await page.getByText(NETWORK[locale], { exact: false }).count()) === 0, "424 on connect: never the network message");

  await jt.getByRole("button", { name: L.verify }).click();
  await settle(page);
  const note = jt.getByRole("status").filter({ hasText: L.title });
  check(await note.isVisible(), "unverified: note on the J&T card");
  check(await note.getByText(L.note, { exact: false }).isVisible(), "unverified: saved, checked on the first booking");
  check((await jt.getByText(upstream).count()) === 0, "earlier error cleared after the connect succeeds");

  const mylerz = cardOf(page, "Mylerz");
  await mylerz.getByRole("button", { name: L.connectMylerz }).click();
  await mylerz.getByLabel("Username").fill("user");
  await mylerz.getByLabel("Password").fill("secret");
  await mylerz.getByRole("button", { name: L.verify }).click();
  await settle(page);
  check((await mylerz.getByText(L.title).count()) === 0, "no verification field: no note on Mylerz");
  check(await jt.getByText(L.title).isVisible(), "J&T note unaffected by another card");

  await jt.getByRole("button", { name: L.replace }).click();
  await fillJt();
  await jt.getByRole("button", { name: L.verify }).click();
  await settle(page);
  check((await jt.getByText(L.title).count()) === 0, "a later key check without the field clears the note");
  await assertClean(session, label);
  return session;
}
