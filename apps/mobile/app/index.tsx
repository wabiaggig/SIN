import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "../lib/useSession";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/lobby" : "/login"} />;
}
