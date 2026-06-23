import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "../utils/theme";
import { GSAV_ACCENT } from "../utils/gsavBridge";
import type { GsavContentItem } from "../services/gsav";
import { useGsavAuthStore } from "../store/gsavAuthStore";
import { useSavedScenesStore } from "../store/savedScenesStore";
import { useLikedScenesStore } from "../store/likedScenesStore";

// Shared 16:9 scene card for the GSAV browse surfaces (feed, search, creator).
// Self-themed; renders the real poster over a cube-icon fallback.
export function SceneCard({
  item,
  onPress,
  onAuthorPress,
}: {
  item: GsavContentItem;
  onPress: () => void;
  onAuthorPress?: () => void;
}) {
  const theme = useTheme();
  const userId = useGsavAuthStore((s) => s.user?.id);
  const saved = useSavedScenesStore((s) => (item.backendId ? s.savedIds.has(item.backendId) : false));
  const toggleSave = useSavedScenesStore((s) => s.toggle);
  const showSave = Boolean(userId && item.backendId);
  const liked = useLikedScenesStore((s) => (item.backendId ? s.likedIds.has(item.backendId) : false));
  const likeCount = useLikedScenesStore((s) => (item.backendId ? s.counts[item.backendId] ?? 0 : 0));
  const toggleLike = useLikedScenesStore((s) => s.toggle);
  const router = useRouter();
  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
      accessibilityLabel={`Open ${item.title}`}
    >
      <View style={[styles.thumb, { backgroundColor: theme.placeholder }]}>
        <Ionicons name="cube-outline" size={26} color={GSAV_ACCENT} />
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : null}
        {showSave ? (
          <Pressable
            style={styles.saveBtn}
            onPress={() => item.backendId && toggleSave(item.backendId)}
            hitSlop={6}
            accessibilityLabel={saved ? "Remove from library" : "Save to library"}
          >
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={15} color={saved ? GSAV_ACCENT : "#ededed"} />
          </Pressable>
        ) : null}
        {item.backendId ? (
          <Pressable
            style={styles.likeBadge}
            onPress={() => {
              if (!userId) {
                router.push("/login" as never);
                return;
              }
              if (item.backendId) toggleLike(item.backendId);
            }}
            hitSlop={6}
            accessibilityLabel={liked ? "Unlike" : "Like"}
          >
            <Ionicons name={liked ? "heart" : "heart-outline"} size={13} color={liked ? "#ff6b81" : "#ededed"} />
            <Text style={styles.likeText}>{likeCount}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        {onAuthorPress ? (
          <Pressable onPress={onAuthorPress} hitSlop={4} accessibilityLabel={`Open ${item.author}`}>
            <Text numberOfLines={1} style={[styles.sub, { color: theme.textSub }]}>{item.author}</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={[styles.sub, { color: theme.textSub }]}>{item.author}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47.5%",
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  thumb: { aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center" },
  saveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(5,5,5,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  likeBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "rgba(5,5,5,0.5)",
  },
  likeText: { color: "#ededed", fontFamily: "Roboto_500Medium", fontSize: 11 },
  info: { padding: 8 },
  title: { fontFamily: "Roboto_500Medium", fontSize: 13 },
  sub: { fontFamily: "Roboto_400Regular", fontSize: 11, marginTop: 2 },
});
