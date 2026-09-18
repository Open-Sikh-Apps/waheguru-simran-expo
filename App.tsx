import { useEffect, useState } from "react";
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

async function isPlayerDead(): Promise<boolean> {
  try {
    const state = await TrackPlayer.getState();
    console.log(JSON.stringify(state));

    // 1. Check for an explicit stopped state string
    if (state.currentState === "stopped") {
      return true;
    }

    // 2. iOS Fallback: If it says 'paused' or 'idle' but everything else is gone,
    // it's effectively dead/finished in a headless context.
    const isIdleState = state.currentState === "paused" || !state.currentState;
    const hasNoTrack = !state.currentTrack && state.currentIndex === -1;

    if (isIdleState && hasNoTrack) {
      return true;
    }

    return false;
  } catch (error) {
    // 3. Native Bridge Fallback: The background service/player instance was destroyed
    console.error(
      "[Background] TrackPlayer bridge rejected or uninitialized:",
      error,
    );
    return true;
  }
}

let configured: Promise<void> | null = null;

async function ensureConfigured(
  audioUrl: string,
  artworkUrl: string,
): Promise<void> {
  try {
    if (!configured || (await isPlayerDead())) {
      configured = (async () => {
        if (await isPlayerDead()) {
          console.log("configuring");
          await TrackPlayer.configure({
            androidAutoEnabled: true,
            carPlayEnabled: true,
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
            url: audioUrl,
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
      })().catch((error) => {
        configured = null;
        throw error;
      });
    }
  } catch (error) {
    configured = null;
    throw error;
  }

  await configured;
}

// const DEBUG_TEXT_PREFIX = "Debug Text: ";

function SimranPlayer() {
  const [assets] = useAssets([require(SIMRAN_AUDIO_PATH)]);
  const audioUrl = assets?.[0]?.localUri;

  const [artworkUrl, setArtworkUrl] = useState<string | undefined>();
  // const [debugText, setDebugText] = useState<string>(DEBUG_TEXT_PREFIX);

  const { state } = useOnPlaybackStateChange();
  const playerPlaying = state === "playing" || state === "buffering";

  const [loadingPlayer, setLoadingPlayer] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchArtwork = async () => {
      try {
        const resolvedUrl = await resolveLockScreenArtworkUrl(
          require(COVER_IMAGE_PATH),
        );
        if (isCurrent) {
          setArtworkUrl(resolvedUrl);
        }
      } catch (error) {
        console.error("Failed to fetch artwork:", error);
      }
    };
    fetchArtwork();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    if (audioUrl && artworkUrl) {
      console.log("assets loaded");
      ensureConfigured(audioUrl, artworkUrl)
        .then(() => {
          if (isCurrent) {
            setLoadingPlayer(false);
          }
        })
        .catch((error) =>
          console.error("Player could not be configured", error),
        );
    }
    return () => {
      isCurrent = false;
    };
  }, [audioUrl, artworkUrl]);

  async function togglePlayback() {
    if (!(audioUrl && artworkUrl)) {
      //should not reach here
      // setDebugText(`${DEBUG_TEXT_PREFIX}should not reach here`);
      return;
    }

    console.log("togglePlayback called");

    if (isActionPending) return;
    try {
      setIsActionPending(true);

      // Always ensure the player is fully configured first
      await ensureConfigured(audioUrl, artworkUrl);

      if (state === "playing") {
        console.log("togglePlayback was playing");
        // setDebugText(`${DEBUG_TEXT_PREFIX}togglePlayback was playing`);
        TrackPlayer.pause();
      } else {
        // setDebugText(`${DEBUG_TEXT_PREFIX}togglePlayback was NOT playing`);
        TrackPlayer.play();
      }
    } catch (error) {
      console.error("Failed to toggle play/pause:", error);
    } finally {
      setIsActionPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        {loadingPlayer ? (
          <ActivityIndicator
            size="large"
            color="#FFFFFF"
            style={styles.spinner}
          />
        ) : (
          <>
            <Image
              source={artworkUrl}
              style={styles.cover}
              contentFit="contain"
            />
            {/* <Text style={{ color: "#FFFFFF" }}>{debugText}</Text> */}
            <View style={styles.controls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  playerPlaying ? "Pause Simran" : "Play Simran"
                }
                hitSlop={16}
                onPress={togglePlayback}
                style={({ pressed }) => [
                  styles.playButton,
                  (pressed || isActionPending) && styles.playButtonPressed,
                ]}
              >
                <PlayPauseIcon playing={playerPlaying} />
              </Pressable>
            </View>
          </>
        )}
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
