import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Alert } from 'react-native';
import { DISCARD_TEXT } from './navigation.constants';

export function useDiscardChanges(dirty: boolean, busy = false, completed?: () => boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (completed?.()) {
      navigation.dispatch(data.action);
      return;
    }
    if (busy) {
      Alert.alert(DISCARD_TEXT.busyTitle, DISCARD_TEXT.busyBody);
      return;
    }
    Alert.alert(DISCARD_TEXT.title, DISCARD_TEXT.body, [
      { text: DISCARD_TEXT.keep, style: 'cancel' },
      {
        text: DISCARD_TEXT.discard,
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
}
