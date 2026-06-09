import {
  Column,
  Icon,
  ListItem,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";

// Material 3 expressive grouped-list primitives shared by the Android
// settings and news screens. Only import this module from `.android.tsx`
// files — it pulls in `@expo/ui/jetpack-compose`, which requires the
// Android-only Compose native views.

// Large outer corners on the group's first/last rows, small corners on the
// edges shared with siblings.
const GROUP_OUTER_RADIUS = 24;
const GROUP_INNER_RADIUS = 5;
const GROUP_ITEM_SPACING = 2;

function getRowShape(isFirstInGroup: boolean, isLastInGroup: boolean) {
  const top = isFirstInGroup ? GROUP_OUTER_RADIUS : GROUP_INNER_RADIUS;
  const bottom = isLastInGroup ? GROUP_OUTER_RADIUS : GROUP_INNER_RADIUS;
  return Shapes.RoundedCorner({
    topStart: top,
    topEnd: top,
    bottomStart: bottom,
    bottomEnd: bottom,
  });
}

export function MaterialSectionHeader({ children }: { children: string }) {
  const colors = useMaterialColors();

  return (
    <Text
      color={colors.primary}
      modifiers={[padding(16, 20, 16, 8)]}
      style={{ typography: "titleSmall" }}
    >
      {children}
    </Text>
  );
}

export function MaterialListGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Column
      modifiers={[fillMaxWidth()]}
      verticalArrangement={{ spacedBy: GROUP_ITEM_SPACING }}
    >
      {children}
    </Column>
  );
}

export interface MaterialListRowProps {
  headline: string;
  supportingText?: string;
  supportingTextMaxLines?: number;
  icon: React.ComponentProps<typeof Icon>["source"];
  iconAccessibilityLabel: string;
  /**
   * Tint for the leading icon. Defaults to the palette's `onSurfaceVariant`.
   */
  iconTint?: string;
  /**
   * Content for the trailing slot (for example a date label or external-link
   * icon). Must be Compose components from `@expo/ui/jetpack-compose`.
   */
  trailing?: React.ReactNode;
  onPress?: () => void;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export function MaterialListRow({
  headline,
  supportingText,
  supportingTextMaxLines,
  icon,
  iconAccessibilityLabel,
  iconTint,
  trailing,
  onPress,
  isFirstInGroup = false,
  isLastInGroup = false,
}: MaterialListRowProps) {
  const colors = useMaterialColors();
  const shape = getRowShape(isFirstInGroup, isLastInGroup);
  const modifiers = onPress
    ? [fillMaxWidth(), clip(shape), clickable(onPress)]
    : [fillMaxWidth(), clip(shape)];

  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainer }}
      modifiers={modifiers}
    >
      <ListItem.HeadlineContent>
        <Text color={colors.onSurface} style={{ typography: "bodyLarge" }}>
          {headline}
        </Text>
      </ListItem.HeadlineContent>
      {supportingText != null ? (
        <ListItem.SupportingContent>
          <Text
            color={colors.onSurfaceVariant}
            maxLines={supportingTextMaxLines}
            overflow={supportingTextMaxLines != null ? "ellipsis" : undefined}
            style={{ typography: "bodyMedium" }}
          >
            {supportingText}
          </Text>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.LeadingContent>
        <Icon
          contentDescription={iconAccessibilityLabel}
          size={24}
          source={icon}
          tint={iconTint ?? colors.onSurfaceVariant}
        />
      </ListItem.LeadingContent>
      {trailing != null ? (
        <ListItem.TrailingContent>{trailing}</ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
}
