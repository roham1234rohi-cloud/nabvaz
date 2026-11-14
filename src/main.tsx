import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// StrictMode is intentionally not used: the app owns an <audio> element and a WebGL context,
// and StrictMode's dev-only double mount would create both twice.
createRoot(document.getElementById('root')!).render(<App />);
