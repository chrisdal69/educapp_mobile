import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../contexts/ThemeContext";

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home-sharp" : "home-outline"} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="research"
        options={{
          title: "Rechercher",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search-sharp" : "search-outline"} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Mon compte",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-sharp" : "person-outline"} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
