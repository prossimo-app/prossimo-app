import { forwardRef } from "react";
import { TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";

interface SearchInputProps {
  accessibilityLabel: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
}

export const SearchInput = forwardRef<TextInput, SearchInputProps>(
  function SearchInput(
    {
      accessibilityLabel,
      onBlur,
      onChangeText,
      onFocus,
      onSubmitEditing,
      placeholder,
      value,
    },
    ref,
  ) {
    return (
      <View className="bg-card h-12 flex-row items-center gap-3 rounded-2xl px-4">
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search" }}
          size={18}
          tintColor="#6b7280"
        />
        <TextInput
          accessibilityLabel={accessibilityLabel}
          autoCapitalize="none"
          autoCorrect={false}
          className="text-foreground -mt-0.5 min-w-0 flex-1 font-sans text-base"
          inputMode="search"
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#6b7280"
          ref={ref}
          returnKeyType="search"
          style={{
            height: 24,
            includeFontPadding: false,
            lineHeight: 20,
            paddingBottom: 0,
            paddingTop: 0,
          }}
          value={value}
        />
      </View>
    );
  },
);
