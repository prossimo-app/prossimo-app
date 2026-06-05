import { useColorScheme, View } from "react-native";
import BackIcon from "@expo/material-symbols/chevron_left.xml";
import CloseIcon from "@expo/material-symbols/close.xml";
import { Host, Icon, IconButton } from "@expo/ui/jetpack-compose";

import { getPrimaryIconColor } from "~/theme/native-colors";

type DrawerIconButtonIcon = "back" | "close";

interface DrawerIconButtonProps {
  accessibilityLabel: string;
  icon: DrawerIconButtonIcon;
  onPress: () => void;
}

const nativeIcons = {
  back: BackIcon,
  close: CloseIcon,
} as const;

export function DrawerIconButton({
  accessibilityLabel,
  icon,
  onPress,
}: DrawerIconButtonProps) {
  const colorScheme = useColorScheme();
  const iconColor = getPrimaryIconColor(colorScheme);

  return (
    <View className="h-12 w-12">
      <Host matchContents>
        <IconButton
          colors={{
            contentColor: iconColor,
          }}
          onClick={onPress}
        >
          <Icon
            contentDescription={accessibilityLabel}
            size={24}
            source={nativeIcons[icon]}
          />
        </IconButton>
      </Host>
    </View>
  );
}
