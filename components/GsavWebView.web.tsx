import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  buildSessionBridgeMessage,
  getConfiguredGsavWebUrl,
  getOrigin,
  isAuthReadyMessage,
} from "../utils/gsavBridge";
import { useGsavAuthStore } from "../store/gsavAuthStore";
import { useTheme } from "../utils/theme";

type GsavWebViewProps = {
  /** Path within the hosted diveo app, e.g. "/" (home) or "/watch/elly". */
  path: string;
};

// World A web preview + World B session bridge: react-native-webview has no web
// target, so we embed the hosted diveo app (gsav-hosting) in a full-screen
// <iframe>. We then hand the native Supabase session to it (origin-checked
// postMessage → the page applies it) so the player's comments/danmaku/like are
// authed as the native user. The real web product is gsav-hosting served
// directly; this build is a dev preview of the native shell.
function buildAppUrl(path: string, baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const route = path.startsWith("/") ? path : `/${path}`;
  return `${base}${route}`;
}

export function GsavWebView({ path }: GsavWebViewProps) {
  const theme = useTheme();
  const baseUrl = useMemo(() => getConfiguredGsavWebUrl(), []);
  const src = useMemo(() => (baseUrl ? buildAppUrl(path, baseUrl) : ""), [baseUrl, path]);
  const origin = useMemo(() => (baseUrl ? getOrigin(baseUrl) : ""), [baseUrl]);
  const session = useGsavAuthStore((s) => s.session);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const postSession = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target || !origin) return;
    target.postMessage(
      buildSessionBridgeMessage(
        session ? { accessToken: session.access_token, refreshToken: session.refresh_token } : null,
      ),
      origin,
    );
  }, [session, origin]);

  // The embedded player announces GSAV_AUTH_READY; reply with the session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      if (event.origin === origin && isAuthReadyMessage(event.data)) postSession();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [origin, postSession]);

  // Resend whenever the session changes (login/logout) while embedded.
  useEffect(() => {
    postSession();
  }, [postSession]);

  if (!src) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>diveo not configured</Text>
        <Text style={[styles.text, { color: theme.textSub }]}>
          Set EXPO_PUBLIC_GSAV_WEB_URL to the diveo web app origin.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <iframe
        ref={iframeRef}
        src={src}
        title="diveo"
        allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
        style={{ border: 0, width: "100%", height: "100%", display: "block", backgroundColor: "#050505" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 16, fontFamily: "Roboto_700Bold" },
  text: { fontSize: 13, fontFamily: "Roboto_400Regular", textAlign: "center" },
});
