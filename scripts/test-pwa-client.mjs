import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  detectPwaEnvironment,
  hasRelatedPwa,
  iosSupportsWebPush,
  pwaInstallGuide,
} from "../lib/pwa-client.ts";
import {
  activatePush,
  localPushState,
  pushCapability,
  syncPushSubscription,
} from "../lib/push-client.ts";

const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";
const iphoneChrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const iphoneInApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/489.0]";
const ipadDesktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
const androidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const ios = detectPwaEnvironment({ userAgent: iphoneSafari });
assert.equal(ios.platform, "ios");
assert.equal(ios.safari, true);
assert.equal(ios.inAppBrowser, false);
assert.equal(iosSupportsWebPush(ios), true);
assert.equal(detectPwaEnvironment({ userAgent: iphoneChrome }).safari, false);
assert.equal(detectPwaEnvironment({ userAgent: iphoneChrome }).inAppBrowser, false);
assert.equal(detectPwaEnvironment({ userAgent: iphoneInApp }).inAppBrowser, true);
assert.equal(detectPwaEnvironment({ userAgent: ipadDesktop, maxTouchPoints: 5 }).platform, "ios");
assert.equal(detectPwaEnvironment({ userAgent: ipadDesktop, maxTouchPoints: 0 }).platform, "other");
assert.equal(detectPwaEnvironment({ userAgent: androidChrome }).platform, "android");
assert.equal(detectPwaEnvironment({ userAgent: `${androidChrome} WhatsApp/2.24` }).inAppBrowser, true);
assert.equal(detectPwaEnvironment({ userAgent: iphoneInApp, standalone: true }).inAppBrowser, false);
assert.equal(iosSupportsWebPush(detectPwaEnvironment({ userAgent: iphoneSafari.replaceAll("17_6", "16_3") })), false);
assert.equal(iosSupportsWebPush(detectPwaEnvironment({ userAgent: iphoneSafari.replaceAll("17_6", "16_4") })), true);
assert.equal(iosSupportsWebPush(detectPwaEnvironment({ userAgent: ipadDesktop, maxTouchPoints: 5 })), true);

const iosGuide = pwaInstallGuide(ios);
assert.ok(iosGuide.description.includes("bukan otomatis"));
assert.ok(iosGuide.steps.some((step) => step.includes("Buka sebagai App Web")));
assert.ok(iosGuide.steps.some((step) => step.includes("Edit Tindakan")));
assert.ok(!iosGuide.steps.some((step) => step.includes("Chrome")));
assert.ok(pwaInstallGuide(detectPwaEnvironment({ userAgent: iphoneInApp })).steps[0].includes("salin alamat"));
assert.ok(pwaInstallGuide(detectPwaEnvironment({ userAgent: iphoneChrome })).steps[0].includes("Safari"));
assert.ok(pwaInstallGuide(detectPwaEnvironment({ userAgent: androidChrome })).steps[0].includes("Chrome"));

const origin = "https://sibuma.example";
assert.equal(hasRelatedPwa([{ platform: "webapp", url: "/manifest.webmanifest" }], origin), true);
assert.equal(hasRelatedPwa([{ platform: "webapp", url: `${origin}/manifest.webmanifest` }], origin), true);
assert.equal(hasRelatedPwa([{ platform: "play", url: "/manifest.webmanifest" }], origin), false);
assert.equal(hasRelatedPwa([{ platform: "webapp", url: "https://other.example/manifest.webmanifest" }], origin), false);
assert.equal(hasRelatedPwa([{ platform: "webapp", url: "/other-manifest.webmanifest" }], origin), false);
assert.equal(hasRelatedPwa([{ platform: "webapp" }], origin), false);

const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const savedNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
let permissionRequests = 0;
let subscriptionReads = 0;

function browser({ userAgent = iphoneSafari, standalone = false, secure = true, pushApis = false, permission = "default", maxTouchPoints = 1 } = {}) {
  const notification = {
    permission,
    requestPermission() {
      permissionRequests += 1;
      throw new Error("Permission must not be requested in capability checks.");
    },
  };
  const navigator = {
    userAgent,
    maxTouchPoints,
    standalone,
    serviceWorker: {
      async getRegistration() {
        subscriptionReads += 1;
        return null;
      },
    },
    // Old markers must not participate in detecting installation/capability.
  };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      navigator,
      isSecureContext: secure,
      matchMedia: () => ({ matches: standalone }),
      ...(pushApis ? { PushManager: {}, Notification: notification } : {}),
    },
  });
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: notification });
}

try {
  browser();
  assert.equal(pushCapability(), "install-required");
  assert.deepEqual(await localPushState(), { capability: "install-required", subscribed: false });
  assert.equal((await activatePush("fixture-public-key")).reason, "install-required");
  await syncPushSubscription();
  assert.equal(permissionRequests, 0);
  assert.equal(subscriptionReads, 0);

  browser({ userAgent: iphoneSafari.replaceAll("17_6", "16_3") });
  assert.equal(pushCapability(), "unsupported");
  browser({ secure: false });
  assert.equal(pushCapability(), "unsupported");
  browser({ standalone: true });
  assert.equal(pushCapability(), "unsupported");
  browser({ standalone: true, pushApis: true });
  assert.equal(pushCapability(), "default");
  browser({ standalone: true, pushApis: true, permission: "denied" });
  assert.equal(pushCapability(), "denied");
  browser({ standalone: true, pushApis: true, permission: "granted" });
  assert.equal(pushCapability(), "granted");
  browser({ userAgent: ipadDesktop, maxTouchPoints: 5 });
  assert.equal(pushCapability(), "install-required");
  browser({ userAgent: androidChrome, pushApis: true });
  assert.equal(pushCapability(), "default");
  assert.equal(permissionRequests, 0);
} finally {
  for (const [name, descriptor] of [["window", savedWindow], ["navigator", savedNavigator], ["Notification", savedNotification]]) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}

const icons = [
  ["icon-180-v4.png", 180],
  ["icon-192-v4.png", 192],
  ["icon-512-v4.png", 512],
  ["icon-maskable-512-v4.png", 512],
];
for (const [name, size] of icons) {
  const icon = await readFile(new URL(`../public/icons/${name}`, import.meta.url));
  assert.equal(icon.subarray(1, 4).toString(), "PNG");
  assert.equal(icon.readUInt32BE(16), size);
  assert.equal(icon.readUInt32BE(20), size);
}
console.log("PASS: PWA platform/guide, related app matching, iOS push prerequisites, no premature permission/subscription calls, and all versioned icon dimensions.");
