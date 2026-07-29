import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import mnMN from 'antd/locale/mn_MN'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import App from './App'
import './index.css'

const ThemedApp = () => {
  const { isDarkMode } = useTheme();
  
  return (
    <ConfigProvider
      locale={mnMN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>,
)
