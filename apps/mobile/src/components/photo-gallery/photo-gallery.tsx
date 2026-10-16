import { GalleryImage } from './gallery-image';
import { StatusBar } from 'expo-status-bar';
import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../icon';
import { ActionButton } from '../action-button';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, spacing, typography } from '../../theme/tokens';

export function PhotoGallery({
  images,
  primaryIndex = 0,
  title,
}: {
  images: readonly PublicVehicleImage[];
  primaryIndex?: number;
  title: string;
}) {
  const initial = Math.max(0, Math.min(primaryIndex, images.length - 1));
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);
  const [viewerHeight, setViewerHeight] = useState(500);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(images[initial]));
  const dimensions = useWindowDimensions();
  const list = useRef<FlatList<PublicVehicleImage>>(null);
  useEffect(() => {
    setSelected(Math.max(0, Math.min(primaryIndex, images.length - 1)));
    if (images.length === 0) setOpen(false);
    setFailed(false);
    setLoading(images.length > 0);
  }, [primaryIndex, images]);
  const image = images[selected] ?? images[0];
  const move = (offset: number) => {
    if (images.length === 0) return;
    const next = Math.max(0, Math.min(selected + offset, images.length - 1));
    setSelected(next);
    setFailed(false);
    setLoading(true);
    if (open) list.current?.scrollToIndex({ index: next, animated: true });
  };
  return (
    <View style={styles.gallery}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CARS_TEXT.openPhotos(title, images.length)}
        disabled={!image}
        onPress={() => setOpen(true)}
        style={styles.hero}
      >
        {image && !failed ? (
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
        ) : (
          <Text style={styles.fallback}>{failed ? CARS_TEXT.imageFailed : CARS_TEXT.noPhoto}</Text>
        )}
        {loading && !failed && image ? (
          <ActivityIndicator
            accessibilityLabel="Loading car photo"
            color={colors.ink}
            style={{ position: 'absolute' }}
          />
        ) : null}
        {image ? (
          <Text style={styles.count}>{CARS_TEXT.photos(selected, images.length)}</Text>
        ) : null}
      </Pressable>
      {images.length > 1 ? (
        <View style={styles.buttons}>
          <View style={styles.half}>
            <ActionButton
              variant="secondary"
              label={CARS_TEXT.previous}
              disabled={selected === 0}
              onPress={() => move(-1)}
            />
          </View>
          <View style={styles.half}>
            <ActionButton
              variant="secondary"
              label={CARS_TEXT.next}
              disabled={selected === images.length - 1}
              onPress={() => move(1)}
            />
          </View>
        </View>
      ) : null}
      {open ? (
        <Modal visible animationType="fade" onRequestClose={() => setOpen(false)}>
          <SafeAreaView style={styles.viewer} edges={['top', 'bottom', 'left', 'right']}>
            <StatusBar style="light" />
            <View style={styles.viewerHeader}>
              <Text style={[styles.white, { flex: 1 }]} numberOfLines={2}>
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={CARS_TEXT.close}
                onPress={() => setOpen(false)}
                style={styles.close}
              >
                <Icon name="close" color="#ffffff" />
              </Pressable>
            </View>
            <FlatList
              onLayout={(event) => setViewerHeight(event.nativeEvent.layout.height)}
              ref={list}
              horizontal
              pagingEnabled
              data={[...images]}
              keyExtractor={(photo, index) => `${photo.url}:${index}`}
              initialScrollIndex={selected}
              getItemLayout={(_data, index) => ({
                length: dimensions.width,
                offset: dimensions.width * index,
                index,
              })}
              onMomentumScrollEnd={(event) =>
                setSelected(
                  Math.max(
                    0,
                    Math.min(
                      images.length - 1,
                      Math.round(event.nativeEvent.contentOffset.x / dimensions.width),
                    ),
                  ),
                )
              }
              onScrollToIndexFailed={() => undefined}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <GalleryImage
                  image={item}
                  index={index}
                  total={images.length}
                  width={dimensions.width}
                  height={viewerHeight}
                />
              )}
            />
            <View style={styles.viewerFooter}>
              <Text style={styles.white}>{CARS_TEXT.photos(selected, images.length)}</Text>
              <View style={styles.buttons}>
                <Pressable
                  accessibilityRole="button"
                  disabled={selected === 0}
                  accessibilityState={{ disabled: selected === 0 }}
                  onPress={() => move(-1)}
                  style={styles.close}
                >
                  <Text style={styles.white}>{CARS_TEXT.previous}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={selected === images.length - 1}
                  accessibilityState={{ disabled: selected === images.length - 1 }}
                  onPress={() => move(1)}
                  style={styles.close}
                >
                  <Text style={styles.white}>{CARS_TEXT.next}</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  gallery: { gap: spacing.sm },
  hero: {
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  fallback: { fontFamily: typography.family, color: colors.muted, fontSize: 14 },
  count: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.page,
    padding: 8,
    borderRadius: 8,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 12,
  },
  buttons: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  half: { flex: 1 },
  viewer: { flex: 1, backgroundColor: '#111111' },
  viewerHeader: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerFooter: { padding: spacing.md, gap: spacing.sm },
  white: { fontFamily: typography.family, color: '#ffffff', fontSize: 15 },
  close: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  fullImage: { width: '100%', height: '100%' },
});
