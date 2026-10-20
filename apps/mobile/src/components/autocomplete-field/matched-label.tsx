import { Text, StyleSheet } from 'react-native';

export function MatchedLabel({ label, search }: { label: string; search: string }) {
  const at = label.toLocaleLowerCase().indexOf(search.toLocaleLowerCase());
  if (!search || at < 0) return <Text>{label}</Text>;
  return (
    <Text>
      {label.slice(0, at)}
      <Text style={styles.match}>{label.slice(at, at + search.length)}</Text>
      {label.slice(at + search.length)}
    </Text>
  );
}
const styles = StyleSheet.create({ match: { fontWeight: '800' } });
