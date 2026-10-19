import { StatusBar } from 'expo-status-bar';
import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../icon';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { spacing, typography } from '../../theme/tokens';
import { GalleryImage } from './gallery-image';
import { GalleryIndicator } from './gallery-indicator';
import { VIEWER_BACKGROUND, VIEWER_TEXT } from './photo-gallery.constants';
import { indexFromOffset, steppedIndex } from './utils';

export function PhotoViewer({
  images,
  title,
  initialIndex,
  onClose,
}: {
  images: readonly PublicVehicleImage[];
  title: string;
  initialIndex: number;
  onClose: (index: number) => void;
}) {
  const dimensions = useWindowDimensions();
  const [selected, setSelected] = useState(initialIndex);
  const [viewerHeight, setViewerHeight] = useState(500);
  const list = useRef<FlatList<PublicVehicleImage>>(null);
  const show = (index: number) => {
    setSelected(index);
    list.current?.scrollToIndex({ index, animated: true });
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const next = steppedIndex(event.nativeEvent.actionName, selected, images.length);
    if (next !== null) show(next);
  };
  return (
    <Modal
      testID="photo-viewer"
      visible
      animationType="fade"
      onRequestClose={() => onClose(selected)}
    >
      <SafeAreaView style={styles.viewer} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={[styles.white, styles.title]} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CARS_TEXT.close}
            onPress={() => onClose(selected)}
            style={styles.close}
          >
            <Icon name="close" color={VIEWER_TEXT} />
          </Pressable>
        </View>
        <View
          testID="photo-viewer-region"
          style={styles.region}
          accessibilityRole="adjustable"
          accessibilityLabel={CARS_TEXT.openPhotos(title, images.length)}
          accessibilityHint={images.length > 1 ? CARS_TEXT.swipeHint : undefined}
          accessibilityValue={{ text: CARS_TEXT.photos(selected, images.length) }}
          accessibilityActions={
            images.length > 1
              ? [
                  { name: 'increment', label: CARS_TEXT.next },
                  { name: 'decrement', label: CARS_TEXT.previous },
                ]
              : []
          }
          onAccessibilityAction={onAccessibilityAction}
        >
          <FlatList
            testID="photo-viewer-list"
            onLayout={(event) => setViewerHeight(event.nativeEvent.layout.height)}
            ref={list}
            horizontal
            pagingEnabled
            data={images}
            keyExtractor={(photo, index) => `${photo.url}:${index}`}
            initialScrollIndex={initialIndex}
            getItemLayout={(_data, index) => ({
              length: dimensions.width,
              offset: dimensions.width * index,
              index,
            })}
            onMomentumScrollEnd={(event) =>
              setSelected(
                indexFromOffset(event.nativeEvent.contentOffset.x, dimensions.width, images.length),
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
        </View>
        <View style={styles.footer}>
          <GalleryIndicator index={selected} total={images.length} tone="viewer" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: VIEWER_BACKGROUND },
  header: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { flex: 1 },
  region: { flex: 1 },
  footer: { padding: spacing.md, minHeight: 56 },
  white: { fontFamily: typography.family, color: VIEWER_TEXT, fontSize: 15 },
  close: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
});
