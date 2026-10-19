import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import { GalleryIndicator } from './gallery-indicator';
import { GallerySlide } from './gallery-slide';
import { PhotoViewer } from './photo-viewer';
import { clampIndex, indexFromOffset, steppedIndex } from './utils';

export function PhotoGallery({
  images,
  primaryIndex = 0,
  title,
}: {
  images: readonly PublicVehicleImage[];
  primaryIndex?: number;
  title: string;
}) {
  const dimensions = useWindowDimensions();
  const initial = clampIndex(primaryIndex, images.length);
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(dimensions.width);
  const list = useRef<FlatList<PublicVehicleImage>>(null);
  const measured = useRef(width);
  useEffect(() => {
    const start = clampIndex(primaryIndex, images.length);
    setSelected(start);
    if (images.length === 0) setOpen(false);
    list.current?.scrollToOffset({ offset: start * measured.current, animated: false });
  }, [primaryIndex, images]);
  const show = (index: number, animated = true) => {
    setSelected(index);
    list.current?.scrollToIndex({ index, animated });
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') {
      setOpen(true);
      return;
    }
    const next = steppedIndex(event.nativeEvent.actionName, selected, images.length);
    if (next !== null) show(next);
  };
  if (images.length === 0)
    return (
      <View style={styles.gallery}>
        <View style={styles.hero}>
          <Text style={styles.fallback}>{CARS_TEXT.noPhoto}</Text>
        </View>
      </View>
    );
  const multiple = images.length > 1;
  return (
    <View style={styles.gallery}>
      <View
        testID="photo-gallery-region"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={CARS_TEXT.openPhotos(title, images.length)}
        accessibilityHint={multiple ? CARS_TEXT.swipeHint : undefined}
        accessibilityValue={{ text: CARS_TEXT.photos(selected, images.length) }}
        accessibilityActions={[
          ...(multiple
            ? [
                { name: 'increment', label: CARS_TEXT.next },
                { name: 'decrement', label: CARS_TEXT.previous },
              ]
            : []),
          { name: 'activate', label: CARS_TEXT.openViewer },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && next !== measured.current) {
            measured.current = next;
            setWidth(next);
            list.current?.scrollToOffset({ offset: selected * next, animated: false });
          }
        }}
        style={styles.hero}
      >
        <FlatList
          testID="photo-gallery-list"
          ref={list}
          horizontal
          pagingEnabled
          scrollEnabled={multiple}
          data={images}
          keyExtractor={(photo, index) => `${photo.url}:${index}`}
          initialScrollIndex={initial}
          getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(event) =>
            setSelected(indexFromOffset(event.nativeEvent.contentOffset.x, width, images.length))
          }
          onScrollToIndexFailed={() => undefined}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <GallerySlide
              image={item}
              width={width}
              onOpen={() => {
                setSelected(index);
                setOpen(true);
              }}
            />
          )}
        />
      </View>
      <GalleryIndicator index={selected} total={images.length} />
      {open ? (
        <PhotoViewer
          images={images}
          title={title}
          initialIndex={selected}
          onClose={(index) => {
            setOpen(false);
            show(index, false);
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  gallery: { gap: spacing.sm },
  hero: {
    aspectRatio: 4 / 3,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: { fontFamily: typography.family, color: colors.muted, fontSize: 14 },
});
