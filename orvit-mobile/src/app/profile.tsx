import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import Avatar from "@/components/ui/Avatar";
import { router } from "expo-router";
import { API_URL } from "@/api/client";
import { getAccessToken } from "@/lib/storage";
import { fonts } from "@/lib/fonts";

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { isDark } = useTheme();

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── m6 colors ──────────────────────────────────────────────
  const bg = isDark ? "#0A0A0A" : "#FFFFFF";
  const surface = isDark ? "#171717" : "#FAFAFA";
  const border = isDark ? "#262626" : "#E5E5E5";
  const text = isDark ? "#E5E5E5" : "#0A0A0A";
  const textMuted = isDark ? "#555555" : "#A3A3A3";
  const sectionColor = isDark ? "#333333" : "#A3A3A3";

  // ── Avatar upload ──────────────────────────────────────────
  async function handleChangeAvatar() {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso denegado",
        "Se necesita acceso a la galeria para cambiar tu foto."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: `avatar.${asset.uri.split(".").pop() || "jpg"}`,
        type: asset.mimeType || "image/jpeg",
      } as unknown as Blob);

      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      await refreshUser();
      Alert.alert("Listo", "Foto de perfil actualizada");
    } catch {
      Alert.alert("Error", "No se pudo cambiar la foto");
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ── Save profile ───────────────────────────────────────────
  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Error", "El nombre no puede estar vacio");
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) throw new Error("Save failed");

      await refreshUser();
      Alert.alert("Perfil actualizado");
      router.back();
    } catch {
      Alert.alert("Error", "No se pudo guardar los cambios");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
          gap: 14,
        }}
      >
        <AnimatedPressable onPress={() => router.back()} haptic="light">
          <Ionicons name="arrow-back" size={22} color={text} />
        </AnimatedPressable>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            fontFamily: fonts.extraBold,
            letterSpacing: -0.84,
            color: text,
          }}
        >
          Perfil
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <AnimatedPressable
            onPress={handleChangeAvatar}
            haptic="light"
            disabled={uploadingAvatar}
          >
            <View style={{ position: "relative" }}>
              {uploadingAvatar ? (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: surface,
                    borderWidth: 1,
                    borderColor: border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="small" color={text} />
                </View>
              ) : user?.avatar ? (
                <Avatar
                  name={user?.name || "Usuario"}
                  size="xl"
                  imageUrl={user.avatar}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: surface,
                    borderWidth: 1,
                    borderColor: border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "700",
                      fontFamily: fonts.bold,
                      color: text,
                    }}
                  >
                    {(user?.name || "U")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
              )}

              {/* Camera badge */}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: text,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: bg,
                }}
              >
                <Ionicons name="camera" size={13} color={bg} />
              </View>
            </View>
          </AnimatedPressable>
        </View>

        {/* Form fields */}
        <View style={{ paddingHorizontal: 20, gap: 20 }}>
          {/* Nombre */}
          <View>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                fontFamily: fonts.bold,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: sectionColor,
                marginBottom: 8,
              }}
            >
              NOMBRE
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={textMuted}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 14,
                fontSize: 13,
                fontFamily: fonts.regular,
                color: text,
              }}
            />
          </View>

          {/* Email (read-only) */}
          <View>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                fontFamily: fonts.bold,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: sectionColor,
                marginBottom: 8,
              }}
            >
              EMAIL
            </Text>
            <TextInput
              value={user?.email || ""}
              editable={false}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 14,
                fontSize: 13,
                fontFamily: fonts.regular,
                color: text,
                opacity: 0.5,
              }}
            />
          </View>

          {/* Empresa (read-only) */}
          <View>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                fontFamily: fonts.bold,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: sectionColor,
                marginBottom: 8,
              }}
            >
              EMPRESA
            </Text>
            <View
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 14,
                justifyContent: "center",
                opacity: 0.5,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.regular,
                  color: text,
                }}
              >
                {user?.companyName || "-"}
              </Text>
            </View>
          </View>

          {/* Rol (read-only) */}
          <View>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                fontFamily: fonts.bold,
                letterSpacing: 0.72,
                textTransform: "uppercase",
                color: sectionColor,
                marginBottom: 8,
              }}
            >
              ROL
            </Text>
            <View
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: 14,
                justifyContent: "center",
                opacity: 0.5,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.regular,
                  color: text,
                }}
              >
                {user?.role || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Save button */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <AnimatedPressable
            onPress={handleSave}
            haptic="medium"
            disabled={saving}
          >
            <View
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: text,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={bg} />
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    fontFamily: fonts.semiBold,
                    color: bg,
                  }}
                >
                  Guardar cambios
                </Text>
              )}
            </View>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
