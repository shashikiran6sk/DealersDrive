import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { typography } from '../../theme/tokens';

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
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  text: { color: '#ffffff', fontFamily: typography.family, fontSize: 15 },
  image: { width: '100%', height: '100%' },
});
