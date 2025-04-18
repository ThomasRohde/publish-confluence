import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header>
        <h1>Confluence Macro Showcase</h1>
        <p>This application demonstrates the Confluence macros implemented in publish-confluence</p>
      </header>
      
      <main>
        <div className="card">
          <h2>Interactive React Component</h2>
          <p>This is an interactive React component that will be embedded in a Confluence page via the HTML macro:</p>
          <button onClick={() => setCount((count) => count + 1)}>
            Count is: {count}
          </button>
        </div>
        
        <div className="info-section">
          <h2>About the Macros</h2>
          <p>
            This showcase demonstrates how to use the various Confluence macros
            available in the publish-confluence tool. The React application is embedded
            using the HTML macro, while the page is enhanced with other macros like
            panels, info boxes, code blocks, and more.
          </p>
        </div>
      </main>
      
      <footer>
        <p>Made with publish-confluence | {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;