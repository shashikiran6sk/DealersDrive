import Svg, { Path } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/tokens';

export function CheckBoxMark({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.checked]}>
      {checked ? (
        <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
          <Path d="M5 12l4 4 10-10" fill="none" stroke="#ffffff" strokeWidth={3} />
        </Svg>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  checked: { backgroundColor: colors.ink },
});
