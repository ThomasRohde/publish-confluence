/**
 * Preview template script
 * Contains all the JavaScript functionality used in the preview template
 */

// No need to redeclare Window interface, it's in types.d.ts

/**
 * Initialize the preview page functionality
 */
export function initPreview(): void {
  // Skip if already initialized
  if (window.previewLoaded) {
    return;
  }
  
  console.log('Preview script loaded');
  
  // Setup expand/collapse functionality for Confluence expand macros
  setupExpandMacros();
  
  // Add syntax highlighting to code blocks
  highlightCodeBlocks();
  
  // Mobile menu toggle
  setupMobileMenu();

  // Mark active page for highlighting
  highlightActivePage();

  // Setup interactive tabs
  setupTabs();
  
  // Mark as initialized
  window.previewLoaded = true;
}

/**
 * Setup expand/collapse functionality for Confluence expand macros
 */
function setupExpandMacros(): void {
  const expandMacros = document.querySelectorAll('.expand-container');
  expandMacros.forEach(macro => {
    const header = macro.querySelector('.expand-header');
    const content = macro.querySelector('.expand-content');
    
    if (header && content) {
      header.addEventListener('click', function() {
        const isExpanded = macro.classList.contains('expanded');
        if (isExpanded) {
          macro.classList.remove('expanded');
          (content as HTMLElement).style.display = 'none';
        } else {
          macro.classList.add('expanded');
          (content as HTMLElement).style.display = 'block';
        }
      });
    }
  });
}

/**
 * Add syntax highlighting to code blocks
 */
function highlightCodeBlocks(): void {
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach(block => {
    const language = block.className.replace('language-', '').trim();
    if (language) {
      applyBasicHighlighting(block as HTMLElement, language);
    }
  });
}

/**
 * Simple syntax highlighting function
 */
function applyBasicHighlighting(codeElement: HTMLElement, language: string): void {
  // Basic syntax highlighting patterns for common languages
  const patterns: Record<string, RegExp> = {
    'javascript': /\b(const|let|var|function|return|if|else|for|while|switch|case|break|class|extends|new|this|import|export|from|as|async|await|try|catch|finally)\b/g,
    'typescript': /\b(const|let|var|function|return|if|else|for|while|switch|case|break|class|extends|interface|type|enum|namespace|implements|readonly|private|protected|public|static|new|this|import|export|from|as|async|await|try|catch|finally)\b/g,
    'python': /\b(def|class|if|elif|else|for|while|try|except|finally|with|import|from|as|return|yield|pass|break|continue|in|is|not|and|or|True|False|None)\b/g,
    'html': /(&lt;[\/]?[a-z][\w-]*(?:\s+[\w-]+=(?:"[^"]*"|'[^']*'))*\s*&gt;)/g,
    'css': /([.#][\w-]+|@media|@keyframes)/g,
    'bash': /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|in)\b/g,
    'generic': /\b(function|return|if|else|for|while|class|new|this)\b/g
  };
  
  // Get the content
  let content = codeElement.textContent || '';
  
  // Apply language-specific highlighting or generic if not found
  const pattern = patterns[language] || patterns.generic;
  content = content.replace(pattern, '<span style="color: #0052CC;">$1</span>');
  
  // Highlight strings
  content = content.replace(/(["'])(.*?)\1/g, '<span style="color: #00875A;">$1$2$1</span>');
  
  // Highlight comments for specific languages
  if (language === 'javascript' || language === 'typescript') {
    content = content.replace(/(\/\/.*$)/gm, '<span style="color: #626F86;">$1</span>');
    content = content.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #626F86;">$1</span>');
  } else if (language === 'python') {
    content = content.replace(/(#.*$)/gm, '<span style="color: #626F86;">$1</span>');
  }
  
  // Set the highlighted content
  codeElement.innerHTML = content;
}

/**
 * Setup mobile menu toggle
 */
function setupMobileMenu(): void {
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function() {
      sidebar.classList.toggle('active');
    });
  }
}

/**
 * Highlight the active page in the navigation
 */
function highlightActivePage(): void {
  const currentPagePath = window.location.pathname;
  const currentPageFilename = currentPagePath.split('/').pop();
  
  if (currentPageFilename) {
    // Find the page link that matches the current page
    const pageLinks = document.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
      const linkUrl = link.getAttribute('href');
      if (linkUrl && linkUrl.endsWith(currentPageFilename)) {
        link.classList.add('active');
        
        // Make sure parents are visible
        let parent = link.closest('.page-children');
        while (parent) {
          (parent as HTMLElement).style.display = 'block';
          parent = parent.parentElement?.closest('.page-children') || null;
        }
      }
    });
  }
}

/**
 * Setup interactive tabs functionality
 */
function setupTabs(): void {
  const tabGroups = document.querySelectorAll('.confluence-tabs');
  tabGroups.forEach(group => {
    const menuItems = group.querySelectorAll('.tabs-menu .tab-menu-item');
    const tabContents = group.querySelectorAll('.tab-content');

    // Initialize first tab as active if none is active
    if (menuItems.length > 0 && !Array.from(menuItems).some(item => item.classList.contains('active'))) {
      menuItems[0].classList.add('active');
      if (tabContents.length > 0) {
        tabContents[0].classList.add('active');
      }
    }

    menuItems.forEach(menuItem => {
      menuItem.addEventListener('click', (event) => {
        event.preventDefault();
        const targetTabId = menuItem.getAttribute('data-tab-id');

        // Deactivate all menu items and contents in this group
        menuItems.forEach(item => item.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Activate the clicked menu item and corresponding content
        menuItem.classList.add('active');
        const targetContent = group.querySelector(`.tab-content[data-tab-id="${targetTabId}"]`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  });
}



/**
 * Helper function to find an object in an array by property
 */
export function find(array: any[], key: string): any {
  return array.find(item => item.key === key);
}

// Initialize the preview on DOM load
document.addEventListener('DOMContentLoaded', function() {
  initPreview();
});

// Export everything for global access if needed
export {
  applyBasicHighlighting, highlightActivePage, highlightCodeBlocks,
  setupExpandMacros, setupMobileMenu, setupTabs
};

