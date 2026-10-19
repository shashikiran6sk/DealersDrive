import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, typography } from '../../theme/tokens';

export function GallerySlide({
  image,
  width,
  onOpen,
}: {
  image: PublicVehicleImage;
  width: number;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setFailed(false);
    setLoading(true);
  }, [image.url]);
  return (
    <Pressable onPress={onOpen} style={[styles.slide, { width }]}>
      {failed ? (
        <Text style={styles.fallback}>{CARS_TEXT.imageFailed}</Text>
      ) : (
        <Image
          recyclingKey={image.url}
          source={{ uri: image.url }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityLabel={image.alt}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
        />
      )}
      {loading && !failed ? (
        <ActivityIndicator
          accessibilityLabel={CARS_TEXT.loadingPhoto}
          color={colors.ink}
          style={styles.spinner}
        />
      ) : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  slide: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  fallback: { fontFamily: typography.family, color: colors.muted, fontSize: 14 },
  spinner: { position: 'absolute' },
});
