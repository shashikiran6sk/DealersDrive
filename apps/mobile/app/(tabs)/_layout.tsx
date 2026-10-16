import { Tabs } from 'expo-router';
import { MarketplaceHeader } from '../../src/components/marketplace-header';
import { CUSTOMER_TABS } from '../../src/features/navigation/navigation.constants';
import { TabIcon } from '../../src/features/navigation/tab-icon';
import { colors, typography } from '../../src/theme/tokens';

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <MarketplaceHeader />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.divider },
        tabBarLabelStyle: { fontFamily: typography.family, fontWeight: '700', fontSize: 11 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
      backBehavior="history"
    >
      {CUSTOMER_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.route}
          name={tab.route}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={color} />,
          }}
        />
      ))}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
