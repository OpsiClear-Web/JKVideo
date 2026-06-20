import { describe, expect, it } from "vitest";

import expoConfig from "../app.config.js";
import verifier from "./verify-native-production-config.js";

const { isLocalHostname, validateNativeProductionConfig } = verifier;
const { isProductionEnv, resolveExpoConfig } = expoConfig;

function baseConfig(overrides = {}) {
  return {
    appConfig: {
      expo: {
        scheme: ["bilibili", "gsav"],
        android: {
          usesCleartextTraffic: false
        },
        ...(overrides.expo ?? {})
      }
    },
    easConfig: {
      build: {
        production: {
          env: {
            EXPO_PUBLIC_APP_ENV: "production",
            EXPO_PUBLIC_GSAV_WEB_URL: "https://gsav.example.com"
          }
        }
      }
    },
    packageJson: {
      scripts: {
        "gsav:preflight": "node scripts/gsav-native-preflight.js",
        "verify:native-production-config": "node scripts/verify-native-production-config.js"
      }
    },
    env: {},
    ...overrides
  };
}

describe("native production config verifier", () => {
  it("resolves Android cleartext differently for local development and production", () => {
    expect(isProductionEnv({ EXPO_PUBLIC_APP_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ EAS_BUILD_PROFILE: "production" })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ EXPO_PUBLIC_APP_ENV: "development" })).toBe(false);

    expect(resolveExpoConfig({ EXPO_PUBLIC_APP_ENV: "development" }).android.usesCleartextTraffic).toBe(true);
    expect(resolveExpoConfig({ EXPO_PUBLIC_APP_ENV: "production" }).android.usesCleartextTraffic).toBe(false);
  });

  it("accepts a production HTTPS GSAV origin and cleartext-disabled Android config", () => {
    const result = validateNativeProductionConfig(baseConfig());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects local, cleartext, and emulator production origins", () => {
    for (const host of ["localhost", "127.0.0.1", "10.0.2.2", "192.168.1.10"]) {
      expect(isLocalHostname(host)).toBe(true);
    }

    const result = validateNativeProductionConfig(baseConfig({
      easConfig: {
        build: {
          production: {
            env: {
              EXPO_PUBLIC_APP_ENV: "production",
              EXPO_PUBLIC_GSAV_WEB_URL: "http://10.0.2.2:5191"
            }
          }
        }
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Production EXPO_PUBLIC_GSAV_WEB_URL must use https.");
    expect(result.errors).toContain("Production EXPO_PUBLIC_GSAV_WEB_URL must not point at localhost, emulator, link-local, or private LAN hosts.");
  });

  it("rejects Android cleartext traffic in production config", () => {
    const result = validateNativeProductionConfig(baseConfig({
      appConfig: {
        expo: {
          scheme: ["bilibili", "gsav"],
          android: {
            usesCleartextTraffic: true
          }
        }
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("android.usesCleartextTraffic must be false or omitted for production builds.");
  });

  it("rejects missing release scripts and missing production GSAV URL", () => {
    const result = validateNativeProductionConfig(baseConfig({
      easConfig: {
        build: {
          production: {
            env: {
              EXPO_PUBLIC_APP_ENV: "production"
            }
          }
        }
      },
      packageJson: {
        scripts: {}
      }
    }));

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("package.json must expose gsav:preflight.");
    expect(result.errors).toContain("package.json must expose verify:native-production-config.");
    expect(result.errors).toContain("Production must provide EXPO_PUBLIC_GSAV_WEB_URL in the environment or EAS production profile.");
  });
});
