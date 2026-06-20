import React, { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import { GsavWebView } from "../../components/GsavWebView";
import { buildGsavWatchPath } from "../../utils/gsavBridge";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function GsavWatchScreen() {
  const params = useLocalSearchParams<{ id?: string; t?: string; share?: string }>();
  const sceneId = firstParam(params.id) ?? "elly";
  const startTime = firstParam(params.t);
  const share = firstParam(params.share);
  const path = useMemo(() => {
    return buildGsavWatchPath(sceneId, { startTime, share });
  }, [sceneId, share, startTime]);

  return <GsavWebView path={path} title="GSAV" />;
}
