import { MaterialCommunityIcons } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

type SelectedPhoto = {
  uri: string;
  contentType: "image/jpeg";
};

type PetPhotoPickerProps = {
  value: string;
  onSelected: (photo: SelectedPhoto) => void;
  onError: (message: string) => void;
};

export function PetPhotoPicker({ value, onSelected, onError }: PetPhotoPickerProps) {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  const [frameSize, setFrameSize] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const panStartRef = useRef(offset);

  const cropMetrics = useMemo(() => {
    if (!asset || !frameSize) return { cropSize: 0, renderedWidth: frameSize, renderedHeight: frameSize, maxX: 0, maxY: 0 };
    const sourceWidth = asset.width || 1024;
    const sourceHeight = asset.height || 1024;
    const cropSize = Math.min(sourceWidth, sourceHeight) / zoom;
    const displayScale = frameSize / cropSize;
    const renderedWidth = sourceWidth * displayScale;
    const renderedHeight = sourceHeight * displayScale;
    return {
      cropSize,
      renderedWidth,
      renderedHeight,
      maxX: Math.max(0, (renderedWidth - frameSize) / 2),
      maxY: Math.max(0, (renderedHeight - frameSize) / 2)
    };
  }, [asset, frameSize, zoom]);

  const metricsRef = useRef(cropMetrics);
  metricsRef.current = cropMetrics;
  offsetRef.current = offset;

  const clampOffset = (value: { x: number; y: number }) => {
    const metrics = metricsRef.current;
    return {
      x: Math.max(-metrics.maxX, Math.min(metrics.maxX, value.x)),
      y: Math.max(-metrics.maxY, Math.min(metrics.maxY, value.y))
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => { panStartRef.current = offsetRef.current; },
      onPanResponderMove: (_event, gesture) => {
        setOffset(clampOffset({ x: panStartRef.current.x + gesture.dx, y: panStartRef.current.y + gesture.dy }));
      }
    })
  ).current;

  useEffect(() => {
    setOffset((current) => clampOffset(current));
  }, [cropMetrics.maxX, cropMetrics.maxY]);

  const pickPhoto = async () => {
    onError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Zezwól aplikacji na dostęp do zdjęć");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1
    });
    if (result.canceled) return;
    setAsset(result.assets[0]);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const confirmCrop = async () => {
    if (!asset) return;
    setIsCropping(true);
    try {
      const sourceWidth = asset.width || 1024;
      const sourceHeight = asset.height || 1024;
      const cropSize = Math.max(1, Math.floor(Math.min(sourceWidth, sourceHeight) / zoom));
      const sourceUnitsPerPoint = frameSize ? cropSize / frameSize : 0;
      const originX = Math.max(0, Math.min(sourceWidth - cropSize, Math.floor((sourceWidth - cropSize) / 2 - offset.x * sourceUnitsPerPoint)));
      const originY = Math.max(0, Math.min(sourceHeight - cropSize, Math.floor((sourceHeight - cropSize) / 2 - offset.y * sourceUnitsPerPoint)));
      const result = await manipulateAsync(
        asset.uri,
        [
          { crop: { originX, originY, width: cropSize, height: cropSize } },
          { resize: { width: 1024, height: 1024 } }
        ],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      onSelected({ uri: result.uri, contentType: "image/jpeg" });
      setAsset(null);
    } catch {
      onError("Nie udało się przyciąć zdjęcia");
    } finally {
      setIsCropping(false);
    }
  };

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(3, Math.max(1, Math.round((current + delta) * 100) / 100)));
  };

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={pickPhoto} activeOpacity={0.85}>
        {value ? (
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons name="camera-plus-outline" size={36} color="#D35400" />
            <Text style={styles.photoTitle}>Dodaj zdjęcie</Text>
          </View>
        )}
        <Text style={styles.hint}>{value ? "Dotknij, aby zmienić kadr lub zdjęcie" : "Wybierz zdjęcie i dopasuj kwadratowy kadr"}</Text>
      </TouchableOpacity>

      <Modal visible={Boolean(asset)} animationType="slide" onRequestClose={() => setAsset(null)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setAsset(null)} disabled={isCropping}>
              <MaterialCommunityIcons name="close" size={28} color="#252A32" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Dopasuj zdjęcie</Text>
            <TouchableOpacity onPress={confirmCrop} disabled={isCropping}>
              <Text style={styles.done}>Gotowe</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editor}>
            <Text style={styles.editorTitle}>Przytnij i przybliż</Text>
            <Text style={styles.editorSubtitle}>Przeciągnij zdjęcie palcem lub myszką i ustaw odpowiednie przybliżenie.</Text>
            <View
              style={styles.cropFrame}
              onLayout={(event) => setFrameSize(event.nativeEvent.layout.width)}
              {...panResponder.panHandlers}
            >
              {asset && frameSize ? (
                <Image
                  source={{ uri: asset.uri }}
                  style={[
                    styles.cropImage,
                    {
                      width: cropMetrics.renderedWidth,
                      height: cropMetrics.renderedHeight,
                      left: (frameSize - cropMetrics.renderedWidth) / 2 + offset.x,
                      top: (frameSize - cropMetrics.renderedHeight) / 2 + offset.y
                    }
                  ]}
                  resizeMode="stretch"
                />
              ) : null}
              <View style={styles.gridVerticalOne} />
              <View style={styles.gridVerticalTwo} />
              <View style={styles.gridHorizontalOne} />
              <View style={styles.gridHorizontalTwo} />
              <View style={styles.cropBorder} />
            </View>

            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomButton} onPress={() => changeZoom(-0.25)} disabled={zoom <= 1 || isCropping}>
                <MaterialCommunityIcons name="minus" size={24} color={zoom <= 1 ? "#B8BDC5" : "#3D2415"} />
              </TouchableOpacity>
              <View style={styles.zoomCopy}><MaterialCommunityIcons name="magnify-plus-outline" size={20} color="#D35400" /><Text style={styles.zoomText}>Przybliżenie {Math.round(zoom * 100)}%</Text></View>
              <TouchableOpacity style={styles.zoomButton} onPress={() => changeZoom(0.25)} disabled={zoom >= 3 || isCropping}>
                <MaterialCommunityIcons name="plus" size={24} color={zoom >= 3 ? "#B8BDC5" : "#3D2415"} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, isCropping && styles.disabled]} onPress={confirmCrop} disabled={isCropping}>
              {isCropping ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Użyj tego kadru</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "#F2E4D8", marginBottom: 14 },
  preview: { width: "100%", maxWidth: 320, aspectRatio: 1, alignSelf: "center", borderRadius: 18, backgroundColor: "#FFF0D2" },
  placeholder: { height: 190, borderRadius: 18, backgroundColor: "#FFF0D2", alignItems: "center", justifyContent: "center" },
  photoTitle: { color: "#3D2415", fontSize: 16, fontWeight: "800", marginTop: 8 },
  hint: { color: "#8A6D5B", fontSize: 12, textAlign: "center", marginTop: 10 },
  modal: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "#ECEEF1" },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#252A32", fontSize: 16, fontWeight: "800" },
  done: { color: "#D35400", fontSize: 16, fontWeight: "800" },
  editor: { flex: 1, padding: 22, alignItems: "center" },
  editorTitle: { color: "#252A32", fontSize: 26, fontWeight: "900" },
  editorSubtitle: { color: "#77808C", fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 5, marginBottom: 22 },
  cropFrame: { width: "100%", maxWidth: 420, aspectRatio: 1, borderRadius: 22, overflow: "hidden", backgroundColor: "#E7E9EC" },
  cropImage: { position: "absolute" },
  cropBorder: { ...StyleSheet.absoluteFillObject, pointerEvents: "none", borderWidth: 3, borderColor: "#FFFFFF", borderRadius: 22 },
  gridVerticalOne: { position: "absolute", pointerEvents: "none", top: 0, bottom: 0, left: "33.333%", width: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  gridVerticalTwo: { position: "absolute", pointerEvents: "none", top: 0, bottom: 0, left: "66.666%", width: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  gridHorizontalOne: { position: "absolute", pointerEvents: "none", left: 0, right: 0, top: "33.333%", height: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  gridHorizontalTwo: { position: "absolute", pointerEvents: "none", left: 0, right: 0, top: "66.666%", height: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  zoomControls: { width: "100%", maxWidth: 420, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22 },
  zoomButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  zoomCopy: { flexDirection: "row", alignItems: "center", gap: 7 },
  zoomText: { color: "#55463E", fontSize: 13, fontWeight: "700" },
  saveButton: { width: "100%", maxWidth: 420, minHeight: 52, borderRadius: 15, backgroundColor: "#D35400", alignItems: "center", justifyContent: "center", marginTop: 24 },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 }
});
