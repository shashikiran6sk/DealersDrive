import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface OverlayControl {
  show: (owner: string, content: ReactNode) => void;
  hide: (owner: string) => void;
}
const OverlayContext = createContext<OverlayControl | null>(null);
export function OverlayHost({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<{ owner: string; content: ReactNode } | null>(null);
  const show = useCallback(
    (owner: string, content: ReactNode) => setOverlay({ owner, content }),
    [],
  );
  const hide = useCallback(
    (owner: string) => setOverlay((current) => (current?.owner === owner ? null : current)),
    [],
  );
  const control = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <OverlayContext.Provider value={control}>
      <View style={styles.root}>
        {children}
        <View pointerEvents="box-none" style={styles.layer}>
          {overlay?.content}
        </View>
      </View>
    </OverlayContext.Provider>
  );
}
export const useOverlay = () => useContext(OverlayContext);
const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, elevation: 30 },
});
