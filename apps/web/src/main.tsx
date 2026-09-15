import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'
import DemoPage from './components/public/DemoPage'
import InfoPage from './components/public/InfoPage'

const page = window.location.pathname.replace(/\/+$/, '') || '/';
const publicPages = ['/docs', '/status', '/security', '/privacy'];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page === '/demo' ? <DemoPage /> : publicPages.includes(page) ? <InfoPage page={page.slice(1)} /> : <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN || "dev-xuzgmpozdykvxgyp.us.auth0.com"}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID || "BVQBker56bNozDLWvYuJRCMzFzzj1oZZ"}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_API_AUDIENCE || "https://api.opscribe.com"
      }}
    >
      <App />
    </Auth0Provider>}
  </StrictMode>,
)
