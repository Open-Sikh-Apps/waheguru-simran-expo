import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Asset, useAssets } from "expo-asset";
// import {
//   requestNotificationPermissionsAsync,
//   setAudioModeAsync,
//   useAudioPlayer,
//   useAudioPlayerStatus,
// } from "expo-audio";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SystemBars } from "react-native-edge-to-edge";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  PlayerQueue,
  TrackItem,
  TrackPlayer,
  useOnPlaybackStateChange,
} from "react-native-nitro-player";

const SIMRAN_AUDIO_PATH = "./assets/audio/wahegurusimranloop.mp3";
const COVER_IMAGE_PATH = "./assets/images/wahegurusimrancover.jpg";

// const LOCK_SCREEN_OPTIONS = {
//   showSeekForward: false,
//   showSeekBackward: false,
// } as const;

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
  // const player = useAudioPlayer(SIMRAN_AUDIO);
  // const status = useAudioPlayerStatus(player);
  // const [artworkUrl, setArtworkUrl] = useState<string | undefined>();
  // const [lockScreenReady, setLockScreenReady] = useState(false);
  // const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // function reloadSource() {
  //   try {
  //     player.replace(SIMRAN_AUDIO);
  //     player.loop = true;
  //   } catch (error) {
  //     console.warn("Failed to reload simran audio", error);
  //   }
  // }

  // useEffect(() => {
  //   if (status.isLoaded) {
  //     setHasLoadedOnce(true);
  //   }
  // }, [status.isLoaded]);

  // useEffect(() => {
  //   const subscription = AppState.addEventListener("change", (nextState) => {
  //     if (nextState !== "active") {
  //       return;
  //     }

  //     // Paused background players can leave ExoPlayer/AVPlayer idle after
  //     // calls or other apps. Reload so play is available again.
  //     if (!player.currentStatus?.isLoaded) {
  //       reloadSource();
  //     }
  //   });

  //   return () => subscription.remove();
  // }, [player, reloadSource]);

  // useEffect(() => {
  //   let cancelled = false;

  //   async function prepare() {
  //     await setAudioModeAsync({
  //       playsInSilentMode: true,
  //       shouldPlayInBackground: true,
  //       interruptionMode: "doNotMix",
  //       allowsRecording: false,
  //     });

  //     if (Platform.OS === "android") {
  //       // Required on Android 13+ for the media playback notification / FGS.
  //       await requestNotificationPermissionsAsync().catch(() => undefined);
  //     }

  //     const resolvedArtwork = await resolveLockScreenArtworkUrl(
  //       COVER_IMAGE,
  //     ).catch((error) => {
  //       console.warn("Failed to resolve lock screen artwork", error);
  //       return undefined;
  //     });
  //     if (cancelled) {
  //       return;
  //     }

  //     setArtworkUrl(resolvedArtwork);
  //     player.loop = true;
  //     setLockScreenReady(true);
  //   }

  //   prepare().catch((error) => {
  //     console.warn("Failed to prepare audio session", error);
  //     setLockScreenReady(true);
  //   });

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [player]);

  // function activateLockScreen() {
  //   try {
  //     player.setActiveForLockScreen(
  //       true,
  //       {
  //         ...LOCK_SCREEN_METADATA_BASE,
  //         ...(artworkUrl ? { artworkUrl } : {}),
  //       },
  //       LOCK_SCREEN_OPTIONS,
  //     );
  //   } catch (error) {
  //     console.warn("Failed to activate lock screen controls", error);
  //   }
  // }

  // function togglePlayback() {
  //   if (!lockScreenReady || !hasLoadedOnce) {
  //     return;
  //   }

  //   if (status.playing) {
  //     player.pause();
  //     return;
  //   }

  //   if (!status.isLoaded) {
  //     reloadSource();
  //   }

  //   activateLockScreen();
  //   player.play();
  // }

  // const isLoading = !lockScreenReady || !hasLoadedOnce;
  const [assets] = useAssets([
    require(SIMRAN_AUDIO_PATH),
    require(COVER_IMAGE_PATH),
  ]);

  const playerStatus = useOnPlaybackStateChange();
  // const [isPrepareError, setPrepareError] = useState(false);
  const configured = useRef(false);

  async function prepare() {
    console.log("preparing");
    if (!(assets && assets[0].localUri && assets[1].localUri)) {
      //assets not loaded yet
      console.log("assets not loaded yet");
      return;
    }
    console.log("assets loaded");
    try {
      if (configured.current) {
        return;
      }
      console.log("configuring");
      if ((await TrackPlayer.getState()).currentState === "stopped") {
        await TrackPlayer.configure({
          androidAutoEnabled: true,
          carPlayEnabled: true,
          showInNotification: true,
        });
        console.log("TrackPlayer.configure done");

        // const artworkUrl = await resolveLockScreenArtworkUrl(COVER_IMAGE);

        const playlistId = await PlayerQueue.createPlaylist(
          LOCK_SCREEN_METADATA_BASE.album,
          undefined,
          assets[1].localUri,
        );
        console.log("PlayerQueue.createPlaylist done");

        const simranTrack: TrackItem = {
          ...LOCK_SCREEN_METADATA_BASE,
          url: assets[0].localUri,
        };

        await PlayerQueue.addTrackToPlaylist(playlistId, simranTrack);
        console.log("PlayerQueue.addTrackToPlaylist done");

        await PlayerQueue.loadPlaylist(playlistId);
        console.log("PlayerQueue.loadPlaylist done");

        await TrackPlayer.setRepeatMode("track");
        console.log("configured");
      }
      configured.current = true;
    } catch (error) {
      console.log(error);
      // setPrepareError(true);
    }
  }

  useEffect(() => {
    prepare();
  }, [assets]);

  async function togglePlayback() {
    console.log("togglePlayback called");
    if (playerStatus.state === "playing") {
      console.log("togglePlayback playing");
      TrackPlayer.pause();
    } else {
      if (playerStatus.state === "stopped") {
        console.log("togglePlayback stopped");
        await prepare();
      }
      TrackPlayer.play();
    }
  }

  const loading = playerStatus.state === "buffering";

  if (!(assets && assets[0].localUri && assets[1].localUri)) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Image source={assets[1]} style={styles.cover} contentFit="contain" />
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
