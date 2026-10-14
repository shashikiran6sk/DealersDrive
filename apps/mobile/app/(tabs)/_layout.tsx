import { Tabs } from 'expo-router';

import { BrandSymbol } from '../../src/components/brand';
import { TAB_TEXT } from '../../src/features/navigation/navigation.constants';
import { TabIcon } from '../../src/features/navigation/tab-icon';
import { colors, typography } from '../../src/theme/tokens';

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerTitle: () => <BrandSymbol />,
        headerStyle: { backgroundColor: colors.page },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.divider },
        tabBarLabelStyle: { fontFamily: typography.family, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_TEXT.home,
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: TAB_TEXT.explore,
          tabBarIcon: ({ color }) => <TabIcon name="explore" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: TAB_TEXT.saved,
          tabBarIcon: ({ color }) => <TabIcon name="saved" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: TAB_TEXT.profile,
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
