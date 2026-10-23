import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/global.css';
import './styles/components.css';
import App from './App';
import { SessionProvider } from './state/session';
import { TicketStoreProvider } from './state/ticketStore';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <TicketStoreProvider>
          <App />
        </TicketStoreProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
