document.addEventListener('DOMContentLoaded', () => {
  // Create app elements
  const app = document.getElementById('app');
  const header = document.createElement('h1');
  const message = document.createElement('p');
  
  // Set content
  header.textContent = 'Hello Confluence!';
  message.textContent = 'This is a simple JavaScript app published to Confluence using publish-confluence.';
  
  // Add elements to the DOM
  app.appendChild(header);
  app.appendChild(message);
});