import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#F4F3EE',
  surface: '#FFFFFF',
  primary: '#0F4C5C',
  secondary: '#E36414',
  accent: '#FB8B24',
  textPrimary: '#1A1A1A',
  textSecondary: '#595959',
  border: '#E0E0E0',
  success: '#2A9D8F',
  error: '#E63946',
  cardBg: '#FFFFFF',
};

const darkColors = {
  background: '#121212',
  surface: '#1E1E1E',
  primary: '#187A91',
  secondary: '#E36414',
  accent: '#FB8B24',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  border: '#333333',
  success: '#2A9D8F',
  error: '#EF476F',
  cardBg: '#1E1E1E',
};

export type ThemeColors = typeof lightColors;

type ThemeContextType = {
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  isDark: false,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
