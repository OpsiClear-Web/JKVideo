import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

import { compareVersions } from '../utils/version';

const GITHUB_API = 'https://api.github.com/repos/OpsiClear-Web/diveo/releases/latest';

/**
 * In-app APK self-updater (Android only). Polls the GitHub Releases API for the latest
 * diveo build; on a newer version it offers a browser download or an in-app
 * download-and-install:
 *
 *   checkUpdate() ─► GitHub API ─► compareVersions(latest, current)
 *        └─ newer ─► Alert ─► downloadAndInstall(url)
 *                              ├─► download APK to cache
 *                              ├─► openInstallSettings()  (grant "install unknown apps")
 *                              └─► triggerInstall()       (ACTION_VIEW install intent)
 *
 * iOS has no in-app install API, so downloadAndInstall is a no-op there. The pure
 * version comparison lives in utils/version (unit-tested).
 */
export function useCheckUpdate() {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const [isChecking, setIsChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const checkUpdate = async (options: { silent?: boolean } = {}) => {
    // silent = launch-time check: only surface a found update, stay quiet on
    // "up to date" / network errors. Non-silent = user tapped "check".
    const silent = options.silent ?? false;
    setIsChecking(true);
    try {
      const res = await fetch(GITHUB_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();

      const latestVersion: string = data.tag_name ?? '';
      const apkAsset = (data.assets as any[]).find((a) =>
        (a.name as string).endsWith('.apk')
      );
      const downloadUrl: string = apkAsset?.browser_download_url ?? '';
      const releaseNotes: string = data.body ?? '';

      if (compareVersions(latestVersion, currentVersion) <= 0) {
        if (!silent) Alert.alert('Up to date', `v${currentVersion} is the latest version.`);
        return;
      }

      Alert.alert(
        `New version ${latestVersion}`,
        releaseNotes || 'A new version is available. Download now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Browser',
            onPress: () => Linking.openURL(downloadUrl),
          },
          {
            text: 'Install in app',
            onPress: () => downloadAndInstall(downloadUrl, latestVersion),
          },
        ]
      );
    } catch (e: any) {
      if (!silent) Alert.alert('Check failed', e?.message ?? 'Network error. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const openInstallSettings = () => {
    IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data: 'package:com.opsiclear.diveo' }
    ).catch(() => {
      // Some older Android versions lack the precise deep-link; fall back to general settings.
      IntentLauncher.startActivityAsync('android.settings.SECURITY_SETTINGS');
    });
  };

  const triggerInstall = async (localUri: string) => {
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });
  };

  const downloadAndInstall = async (url: string, version: string) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Notice', 'In-app install is only supported on Android.');
      return;
    }
    const localUri = FileSystem.cacheDirectory + `diveo-${version}.apk`;
    try {
      setDownloadProgress(0);
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadProgress(
              Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
            );
          }
        }
      );
      await downloadResumable.downloadAsync();
      setDownloadProgress(null);

      // Android 8.0+ requires the user to allow "install unknown apps" for this app in
      // system settings. A denial doesn't throw a JS error, so guide the user after download.
      Alert.alert(
        'Download complete',
        'If install is blocked, tap "Open settings" and allow diveo to install unknown apps, then return and retry.',
        [
          { text: 'Open settings', onPress: openInstallSettings },
          {
            text: 'Install',
            onPress: () => {
              triggerInstall(localUri).catch((e: any) => {
                Alert.alert('Install failed', e?.message ?? 'Enable "install unknown apps" in settings, then retry.');
              });
            },
          },
        ]
      );
    } catch (e: any) {
      setDownloadProgress(null);
      Alert.alert('Download failed', e?.message ?? 'Please try again.');
    }
  };

  return { currentVersion, isChecking, downloadProgress, checkUpdate };
}
