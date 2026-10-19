import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { typography } from '../../theme/tokens';
import { VIEWER_TEXT } from './photo-gallery.constants';

export function GalleryImage({
  image,
  index,
  total,
  width,
  height,
}: {
  image: PublicVehicleImage;
  index: number;
  total: number;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setFailed(false);
    setLoading(true);
  }, [image.url]);
  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      {failed ? (
        <Text accessibilityRole="alert" style={styles.text}>
          {CARS_TEXT.imageFailed}
        </Text>
      ) : (
        <Image
          accessible
          source={{ uri: image.url }}
          style={styles.image}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={image.url}
          accessibilityLabel={`${image.alt}. ${CARS_TEXT.photos(index, total)}`}
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
          color={VIEWER_TEXT}
          style={{ position: 'absolute' }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  text: { color: VIEWER_TEXT, fontFamily: typography.family, fontSize: 15 },
  image: { width: '100%', height: '100%' },
});
