import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

export default function TabLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg , height: 80},
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleAlign: "center",
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: user?.publicname ?? "Ma classe",
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
