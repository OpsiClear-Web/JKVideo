import React, { useEffect, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { GSAV_ACCENT, GSAV_ACCENT_CONTRAST, getConfiguredGsavWebUrl } from "../utils/gsavBridge";
import { useTheme } from "../utils/theme";

type GsavWebViewProps = {
  path: string;
  title: string;
};

/**
 * Web variant of the GSAV player surface. react-native-webview has no web target
 * ("WebView does not support this platform"), so on web we cannot embed the player
 * in-shell. Instead we hand off to the hosted diveo web app (gsav-hosting) at the
 * configured origin -- which IS the real web product. We navigate to the plain
 * /watch path (NOT the ?embed=native variant): there is no ReactNativeWebView
 * bridge on web, so the standalone player page is the correct target. The native
 * in-shell player + bridge live in GsavWebView.tsx (native only); metro resolves
 * this .web.tsx for the web bundle so react-native-webview is never imported here.
 */
export function GsavWebView({ path, title }: GsavWebViewProps) {
  const router = useRouter();
  const theme = useTheme();
  const baseUrl = useMemo(() => getConfiguredGsavWebUrl(), []);
  const target = useMemo(() => {
    if (!baseUrl) return "";
    const base = baseUrl.replace(/\/+$/, "");
    const route = path.startsWith("/") ? path : `/${path}`;
    return `${base}${route}`;
  }, [baseUrl, path]);

  useEffect(() => {
    if (target && typeof window !== "undefined") {
      window.location.replace(target);
    }
  }, [target]);

  const openManually = () => {
    if (target) Linking.openURL(target);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={["top", "left", "right"]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.content}>
        {target ? (
          <>
            <Text style={[styles.message, { color: theme.text }]}>Opening the diveo player…</Text>
            <Text style={[styles.sub, { color: theme.textSub }]}>If it doesn&apos;t open automatically:</Text>
            <Pressable style={styles.cta} onPress={openManually} accessibilityLabel="Open the diveo player">
              <Text style={styles.ctaText}>Open player</Text>
            </Pressable>
            <Text numberOfLines={1} style={[styles.url, { color: theme.textSub }]}>{target}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.message, { color: theme.text }]}>diveo player not configured</Text>
            <Text style={[styles.sub, { color: theme.textSub }]}>
              Set EXPO_PUBLIC_GSAV_WEB_URL to the diveo web app origin to enable playback on web.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontFamily: "Roboto_700Bold" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  message: { fontSize: 16, fontFamily: "Roboto_700Bold" },
  sub: { fontSize: 13, fontFamily: "Roboto_400Regular", textAlign: "center" },
  cta: {
    marginTop: 8,
    minWidth: 120,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: GSAV_ACCENT,
    borderRadius: 8,
  },
  ctaText: { color: GSAV_ACCENT_CONTRAST, fontSize: 14, fontFamily: "Roboto_700Bold" },
  url: { fontSize: 12, fontFamily: "Roboto_400Regular", marginTop: 4 },
});
