import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { Alert } from 'react-native';

export function useDiscardChanges(dirty: boolean, busy = false, completed?: () => boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (completed?.()) {
      navigation.dispatch(data.action);
      return;
    }
    if (busy) {
      Alert.alert('Sending your request', 'Please wait for this request to finish.');
      return;
    }
    Alert.alert('Discard changes?', 'Your unsent changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
