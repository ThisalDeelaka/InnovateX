import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';  // Tailwind CSS imports
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')  // This is where the App component will be mounted in the DOM
);
