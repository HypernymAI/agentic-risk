const { chromium } = require('playwright');

async function findToSPage(websiteDomain) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Construct search query
    const searchQuery = `${websiteDomain} terms of service OR terms and conditions`;
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // Navigate to Google
    await page.goto(`https://www.google.com/search?q=${encodedQuery}`);
    
    // Wait for and get the first result
    const firstResult = await page.waitForSelector('div.g a', { timeout: 5000 });
    const firstLink = await firstResult.getAttribute('href');
    
    // Visit the ToS page
    await page.goto(firstLink);
    
    // Get page title and URL
    const title = await page.title();
    const finalUrl = page.url();
    
    console.log('Found Terms of Service page:');
    console.log('Title:', title);
    console.log('URL:', finalUrl);
    
    // Optional: Save the content
    const content = await page.content();
    require('fs').writeFileSync('terms_of_service.html', content);
    console.log('Content saved to terms_of_service.html');
    
    return {
      title,
      url: finalUrl,
      content
    };
  } catch (error) {
    console.error('Error finding Terms of Service page:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Example usage
async function main() {
  try {
    await findToSPage('nike.com');
  } catch (error) {
    console.error('Script failed:', error);
  }
}

// Run the script
main();