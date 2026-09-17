import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Asset, useAssets } from "expo-asset";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SystemBars } from "react-native-edge-to-edge";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  PlayerQueue,
  TrackItem,
  TrackPlayer,
  useOnPlaybackStateChange,
} from "react-native-nitro-player";

if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}

const SIMRAN_AUDIO_PATH = "./assets/audio/wahegurusimranloop.mp3";
const COVER_IMAGE_PATH = "./assets/images/wahegurusimrancover.jpg";

const LOCK_SCREEN_METADATA_BASE = {
  id: "1",
  title: "Wahe-Guru Simran",
  artist: "Bhai Sahib Bhai Sewa Singh Ji Tarmala",
  album: "Simran | Gurdwara Prabh Milne Ka Chao, Moga",
  duration: 3,
};

function toLockScreenArtworkUrl(
  uri: string | null | undefined,
): string | undefined {
  if (!uri) {
    return undefined;
  }
  // Native Metadata.artworkUrl needs a real filesystem/http URL.
  // Skip Expo virtual paths like file:///android_res/... and bare drawable names.
  if (uri.startsWith("file:///android_res/")) {
    return undefined;
  }
  if (
    uri.startsWith("file://") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://")
  ) {
    return uri;
  }
  return undefined;
}

/**
 * Android release builds often expose images as drawable resource names (no scheme)
 * and mark them already "downloaded". Force a cache copy so lock-screen artwork
 * gets a real file:// URI that Media3 can load without crashing.
 */
async function resolveLockScreenArtworkUrl(
  moduleId: number,
): Promise<string | undefined> {
  const asset = Asset.fromModule(moduleId);
  const existing = toLockScreenArtworkUrl(asset.localUri ?? asset.uri);
  if (existing) {
    return existing;
  }

  asset.downloaded = false;
  asset.localUri = null;
  await asset.downloadAsync();
  return toLockScreenArtworkUrl(asset.localUri ?? asset.uri);
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return (
    <MaterialIcons
      name={playing ? "pause" : "play-arrow"}
      size={80}
      color="#FFFFFF"
    />
  );
}

function SimranPlayer() {
  const [assets] = useAssets([require(SIMRAN_AUDIO_PATH)]);
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>();

  const playerStatus = useOnPlaybackStateChange();
  const configured = useRef(false);

  async function prepare() {
    console.log("preparing");
    if (!(assets && assets[0].localUri && artworkUrl)) {
      //assets not loaded yet
      console.log("assets not loaded yet");
      const resolvedArtworkUrl = await resolveLockScreenArtworkUrl(
        require(COVER_IMAGE_PATH),
      );
      setArtworkUrl(resolvedArtworkUrl);
      return;
    }
    console.log("assets loaded");
    try {
      if (configured.current) {
        return;
      }
      if ((await TrackPlayer.getState()).currentTrack == null) {
        console.log("configuring");
        await TrackPlayer.configure({
          androidAutoEnabled: true,
          carPlayEnabled: false,
          showInNotification: true,
        });
        console.log("TrackPlayer.configure done");

        const playlistId = await PlayerQueue.createPlaylist(
          LOCK_SCREEN_METADATA_BASE.album,
          undefined,
          artworkUrl,
        );
        console.log("PlayerQueue.createPlaylist done");

        const simranTrack: TrackItem = {
          ...LOCK_SCREEN_METADATA_BASE,
          url: assets[0].localUri,
          artwork: artworkUrl,
        };

        await PlayerQueue.addTrackToPlaylist(playlistId, simranTrack);
        console.log("PlayerQueue.addTrackToPlaylist done");

        await PlayerQueue.loadPlaylist(playlistId);
        console.log("PlayerQueue.loadPlaylist done");

        await TrackPlayer.setRepeatMode("track");
        console.log("configured");
      } else {
        console.log("already configured");
      }
      configured.current = true;
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    prepare();
  }, [assets, artworkUrl]);

  async function togglePlayback() {
    console.log("togglePlayback called");
    if (playerStatus.state === "playing") {
      console.log("togglePlayback was playing");
      TrackPlayer.pause();
    } else {
      if (playerStatus.state === "stopped") {
        console.log("togglePlayback was stopped");
        await prepare();
      }
      TrackPlayer.play();
    }
  }

  const loading = playerStatus.state === "buffering";

  if (!(assets && artworkUrl)) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Image source={artworkUrl} style={styles.cover} contentFit="contain" />
        <View style={styles.controls}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#FFFFFF"
              style={styles.spinner}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                playerStatus.state == "playing" ? "Pause Simran" : "Play Simran"
              }
              hitSlop={16}
              onPress={togglePlayback}
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.playButtonPressed,
              ]}
            >
              <PlayPauseIcon playing={playerStatus.state == "playing"} />
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <SimranPlayer />
      </View>
      <SystemBars style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    margin: 24,
  },
  cover: {
    flex: 1,
    width: "100%",
  },
  controls: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    minHeight: 96,
  },
  playButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 96,
    height: 96,
  },
  playButtonPressed: {
    opacity: 0.7,
  },
  spinner: {
    width: 80,
    height: 80,
  },
});
