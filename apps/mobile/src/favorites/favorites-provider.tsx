import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";

import type { RouteType } from "~/components/home-bottom-drawer/types";

const favoriteStopsStorageKey = "favorites.stops";
const favoriteLinesStorageKey = "favorites.lines";

export interface FavoriteStop {
  stopCode: string | null;
  stopId: string;
  stopName: string;
}

export interface FavoriteLine {
  color: string | null;
  longName: string | null;
  routeId: string;
  shortName: string;
  textColor: string | null;
  type: RouteType;
}

interface FavoritesContextValue {
  favoriteLines: FavoriteLine[];
  favoriteStops: FavoriteStop[];
  hasLoadedFavorites: boolean;
  isLineFavorite: (routeId: string) => boolean;
  isStopFavorite: (stopId: string) => boolean;
  toggleFavoriteLine: (line: FavoriteLine) => void;
  toggleFavoriteStop: (stop: FavoriteStop) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const routeTypes: RouteType[] = ["bus", "metro", "rail", "tram", "unknown"];

function parseFavoriteStops(raw: string | null): FavoriteStop[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const stop = entry as Partial<FavoriteStop>;

      if (
        typeof stop.stopId !== "string" ||
        typeof stop.stopName !== "string"
      ) {
        return [];
      }

      return [
        {
          stopCode: typeof stop.stopCode === "string" ? stop.stopCode : null,
          stopId: stop.stopId,
          stopName: stop.stopName,
        },
      ];
    });
  } catch {
    return [];
  }
}

function parseFavoriteLines(raw: string | null): FavoriteLine[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return [];
      }

      const line = entry as Partial<FavoriteLine>;

      if (
        typeof line.routeId !== "string" ||
        typeof line.shortName !== "string"
      ) {
        return [];
      }

      return [
        {
          color: typeof line.color === "string" ? line.color : null,
          longName: typeof line.longName === "string" ? line.longName : null,
          routeId: line.routeId,
          shortName: line.shortName,
          textColor: typeof line.textColor === "string" ? line.textColor : null,
          type:
            routeTypes.find((routeType) => routeType === line.type) ??
            "unknown",
        },
      ];
    });
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false);
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);
  const [favoriteLines, setFavoriteLines] = useState<FavoriteLine[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadFavorites() {
      try {
        const [savedStops, savedLines] = await Promise.all([
          SecureStore.getItemAsync(favoriteStopsStorageKey),
          SecureStore.getItemAsync(favoriteLinesStorageKey),
        ]);

        if (!isMounted) {
          return;
        }

        setFavoriteStops(parseFavoriteStops(savedStops));
        setFavoriteLines(parseFavoriteLines(savedLines));
      } finally {
        if (isMounted) {
          setHasLoadedFavorites(true);
        }
      }
    }

    void loadFavorites();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavoriteStop = useCallback((stop: FavoriteStop) => {
    setFavoriteStops((currentStops) => {
      const nextStops = currentStops.some(
        (currentStop) => currentStop.stopId === stop.stopId,
      )
        ? currentStops.filter(
            (currentStop) => currentStop.stopId !== stop.stopId,
          )
        : [...currentStops, stop];

      void SecureStore.setItemAsync(
        favoriteStopsStorageKey,
        JSON.stringify(nextStops),
      );

      return nextStops;
    });
  }, []);

  const toggleFavoriteLine = useCallback((line: FavoriteLine) => {
    setFavoriteLines((currentLines) => {
      const nextLines = currentLines.some(
        (currentLine) => currentLine.routeId === line.routeId,
      )
        ? currentLines.filter(
            (currentLine) => currentLine.routeId !== line.routeId,
          )
        : [...currentLines, line];

      void SecureStore.setItemAsync(
        favoriteLinesStorageKey,
        JSON.stringify(nextLines),
      );

      return nextLines;
    });
  }, []);

  const isStopFavorite = useCallback(
    (stopId: string) => favoriteStops.some((stop) => stop.stopId === stopId),
    [favoriteStops],
  );

  const isLineFavorite = useCallback(
    (routeId: string) => favoriteLines.some((line) => line.routeId === routeId),
    [favoriteLines],
  );

  const value = useMemo(
    () => ({
      favoriteLines,
      favoriteStops,
      hasLoadedFavorites,
      isLineFavorite,
      isStopFavorite,
      toggleFavoriteLine,
      toggleFavoriteStop,
    }),
    [
      favoriteLines,
      favoriteStops,
      hasLoadedFavorites,
      isLineFavorite,
      isStopFavorite,
      toggleFavoriteLine,
      toggleFavoriteStop,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (context === null) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }

  return context;
}
