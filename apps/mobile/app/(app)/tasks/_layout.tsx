import { Stack } from 'expo-router'
import { colors } from '../../../src/theme'

export default function TasksLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    />
  )
}
