import { Image, StyleSheet, Text, View } from 'react-native';

import logo from '../../assets/logo.png';
import { colors, typography } from '../../theme/tokens';

export function Brand() {
  return (
    <View style={styles.brand}>
      <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={styles.name}>Dealers-Drive</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 10 },
  name: { color: colors.ink, fontFamily: typography.family, fontSize: 17, fontWeight: '800' },
});
