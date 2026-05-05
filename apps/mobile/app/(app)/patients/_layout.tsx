import { Stack } from 'expo-router'
import { colors } from '../../../src/theme'

export default function PatientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    />
  )
}
