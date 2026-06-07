import { useColorScheme, View } from "react-native";
import BackIcon from "@expo/material-symbols/chevron_left.xml";
import CloseIcon from "@expo/material-symbols/close.xml";
import NewspaperIcon from "@expo/material-symbols/newspaper.xml";
import { Host, Icon, IconButton } from "@expo/ui/jetpack-compose";

import { getPrimaryIconColor } from "~/theme/native-colors";

type DrawerIconButtonIcon = "back" | "close" | "news";

interface DrawerIconButtonProps {
  accessibilityLabel: string;
  hasBadge?: boolean;
  icon: DrawerIconButtonIcon;
  onPress: () => void;
}

const nativeIcons = {
  back: BackIcon,
  close: CloseIcon,
  news: NewspaperIcon,
} as const;

export function DrawerIconButton({
  accessibilityLabel,
  hasBadge = false,
  icon,
  onPress,
}: DrawerIconButtonProps) {
  const colorScheme = useColorScheme();
  const iconColor = getPrimaryIconColor(colorScheme);

  return (
    <View className="relative h-12 w-12">
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
      {hasBadge ? (
        <View className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500" />
      ) : null}
    </View>
  );
}
